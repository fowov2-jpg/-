// Run with CHROMIUM_PATH=/usr/bin/chromium node tools/fleet-verify.cjs.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 const E=await import('../web/engine.js'),{FLEET_ART}=await import('../web/fleet-art.js');
 const {createServer}=await import('./serve.js'),server=createServer();
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 const report={verified:[],widths:[],errors:[],missingMapAsset:false};
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:412,height:915}}),origin=`http://127.0.0.1:${server.address().port}`;
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400){if(r.url().endsWith('/seamless-neighborhood.webp'))report.missingMapAsset=true;else report.errors.push(`${r.status()} ${r.url()}`);}});
  await fs.mkdir('test-results/fleet',{recursive:true});
  await page.route('**/save-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Save fixture</title>'}));
  await page.goto(origin);
  const load=async s=>{await page.goto(origin+'/save-fixture');await page.evaluate(raw=>{localStorage.clear();localStorage.setItem('upravdom.v1',raw);localStorage.setItem('upravdom.settings',JSON.stringify({sound:false,motion:true,labels:true}));},E.encode(s));await page.goto(origin);await page.waitForFunction(()=>document.querySelector('#map').dataset.vehicles==='ready');};
  const click=(action,attrs='')=>page.locator(`[data-action="${action}"]${attrs}`).click();
  const tab=tab=>page.locator(`[data-tab="${tab}"]`).click();
  const state=async()=>E.decode(await page.evaluate(()=>localStorage.getItem('upravdom.v1')));
  for(const id of Object.keys(FLEET_ART)){
   const model=E.VEHICLE_MODELS.find(m=>m.id===id),type=model.supportedTypes?.[0]??0,service=E.TYPES[type][1];
   await load(E.fresh());await tab('services');await click('disband',`[data-id="${service}"]`);
   await tab('garage');await click('subpage','[data-sub="buy"]');
   assert.equal(await page.locator('[data-action="buyVehicle"]').count(),17);
   const picture=page.locator(`.vehiclePhoto[data-model="${id}"]`);await picture.scrollIntoViewIfNeeded();
   assert.equal(await picture.getAttribute('aria-label'),model.name);
   assert.ok(!(await picture.getAttribute('style')).includes('undefined'));
   await click('buyVehicle',`[data-model="${id}"]`);assert.equal((await state()).vehicles.at(-1).model,id);
   await click('subpage','[data-sub="fleet"]');await page.locator(`.vehiclePhoto[data-model="${id}"]`).scrollIntoViewIfNeeded();
   if(id==='gazelle-next-van')await page.screenshot({path:'test-results/fleet/garage.png'});
   await tab('services');await click('newCrew');
   await page.locator('#crew-person-1').selectOption(String(service*2));await page.locator('#crew-person-2').selectOption(String(service*2+1));await page.locator('#crew-vehicle').selectOption('3');await click('formCrew');
   await tab('map');await click('start');
   const s=await state(),call=E.spawn(s,type,0);await load(s);
   await tab('calls');await click('call',`[data-id="${call.id}"]`);await click('dispatch','[data-crew="3"]');
   const dispatched=await state();assert.equal(dispatched.crews.find(c=>c.id===3).status,'travel');
   await page.reload();await page.waitForFunction(model=>document.querySelector('#map').dataset.vehicles==='ready'&&JSON.parse(document.querySelector('#map').dataset.fleet||'[]').some(p=>p.model===model),id);
   const drawing=await page.evaluate(async model=>{
    const {drawVehicle,loadArtwork}=await import('./map.js');loadArtwork(()=>{});
    const canvas=document.createElement('canvas');canvas.width=160;canvas.height=160;
    drawVehicle(canvas.getContext('2d'),[80,80],-Math.PI/2,model,1.4,'#ff665e');
    const pixels=canvas.getContext('2d').getImageData(0,0,160,160).data;
    let opaque=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>100)opaque++;
    return opaque;
   },id);assert.ok(drawing>150,`${id}: missing Canvas artwork`);
   report.verified.push(id);
  }
  for(const width of [360,412,560,1200]){
   await page.setViewportSize({width,height:915});await load(E.fresh());await tab('garage');await click('subpage','[data-sub="buy"]');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.equal(await page.locator('.garageCard').count(),17);
   await page.screenshot({path:`test-results/fleet/catalog-${width}.png`,fullPage:true});report.widths.push(width);
  }
  // Show all sprites and their actual runtime crops on a review page, without altering the source PNG.
  await page.evaluate(async()=>{
   const {vehicle}=await import('./graphics.js'),{FLEET_ART}=await import('./fleet-art.js'),{VEHICLE_MODELS}=await import('./content.js');
   document.body.innerHTML=`<div style="padding:24px;display:grid;grid-template-columns:repeat(4,1fr);gap:24px">${Object.keys(FLEET_ART).map(id=>`<article style="text-align:center"><div class="vehicleStage">${vehicle(2,id)}</div><p>${VEHICLE_MODELS.find(m=>m.id===id).name}</p></article>`).join('')}</div>`;
  });await page.screenshot({path:'test-results/fleet/all-vehicles.png',fullPage:true});
  assert.deepEqual(report.errors,[]);await fs.writeFile('test-results/fleet/report.json',JSON.stringify(report,null,2));
  console.log(`Fleet verified: ${report.verified.length} purchase/crew/dispatch/reload/Canvas flows; ${report.widths.length} screen widths. Missing map asset: ${report.missingMapAsset}.`);
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
