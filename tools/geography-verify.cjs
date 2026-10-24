const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const {createServer}=await import('./serve.js'),server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await fs.mkdir('test-results/geography',{recursive:true});
  await page.evaluate(async()=>{
   const M=await import('./campaign-map.js');await new Promise(resolve=>{M.loadArt(()=>{});const t=setInterval(()=>{const c=document.createElement('canvas');c.style.cssText='width:1px;height:1px';document.body.append(c);M.render(c,{seed:112,region:0,crews:[],calls:[],done:[]},{x:0,y:0,scale:.004},{motion:false});const ready=c.dataset.renderer==='ready';c.remove();if(ready){clearInterval(t);resolve();}},50);});
  });
  async function render(name,width,height,scene){
   const result=await page.evaluate(async({width,height,scene})=>{
    const M=await import('./campaign-map.js'),C=await import('./campaign-city.js'),E=await import('./campaign-engine.js');
    document.body.innerHTML='<canvas id="preview"></canvas>';const canvas=document.querySelector('canvas');canvas.style.cssText=`width:${width}px;height:${height}px;display:block`;document.body.style.cssText='margin:0;background:#071b22';
    const s=E.fresh(112);s.crews=[];if(scene==='city')s.region=19;if(scene==='dense')s.region=7;if(scene==='industry')s.region=5;
    let view=scene==='city'||scene==='locked'?{x:C.DW*2.5,y:C.DH*2,scale:Math.min(width/(C.DW*5),height/(C.DH*4))}:['district','dense','industry'].includes(scene)?{x:C.districtOrigin(s.region)[0]+C.DW/2,y:C.districtOrigin(s.region)[1]+C.DH/2,scale:width/C.DW}:{x:6.5*C.TW,y:2.5*C.TH,scale:.75};
    M.render(canvas,s,view,{labels:false,motion:false});return {hits:view.hits,ready:canvas.dataset.renderer};
   },{width,height,scene});assert.equal(result.ready,'ready');await page.locator('canvas').screenshot({path:`test-results/geography/${name}.png`});return result;
  }
  await render('assembled-city',3000,1482,'city');await render('assembled-district',2800,1728,'district');await render('waterfront',1400,1000,'water');await render('dense-district',2800,1728,'dense');await render('industrial-district',2800,1728,'industry');
  await render('locked-city',1440,900,'locked');
  // A visual fixture can reveal all geography; engine progress and locks stay independent.
  const checks=await page.evaluate(async()=>{
   const M=await import('./campaign-map.js'),C=await import('./campaign-city.js'),E=await import('./campaign-engine.js'),s=E.fresh(112),v={x:C.DW*2.5,y:C.DH*2,scale:.02},c=document.querySelector('canvas');M.render(c,s,v,{motion:false,labels:false});
   let blocked=false;try{E.nextDistrict(s);}catch{blocked=true;}return {districtHits:v.hits.filter(h=>h.kind==='district').length,region:s.region,blocked,homes:C.district(s.seed,0).homes.length,types:C.ART.length};
  });assert.equal(checks.districtHits,20);assert.equal(checks.region,0);assert.equal(checks.blocked,true);assert.equal(checks.homes,999);assert.equal(checks.types,10);assert.deepEqual(errors,[]);
  await fs.writeFile('test-results/geography/report.json',JSON.stringify({checks,errors},null,2));console.log('GEOGRAPHY VERIFIED: ten art families, 20 visible districts, progression locks, runtime map previews');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
