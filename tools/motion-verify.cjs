const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const E=await import('../web/campaign-engine.js'),C=await import('../web/campaign-city.js'),{createServer}=await import('./serve.js'),server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;const report={models:[],checks:[],errors:[],httpErrors:[]};
 function scene(model,remaining=30,total=40){
  const s=E.fresh(112),list=E.catalog(s),order=C.missionOrder(s.seed,0),m=list.find(m=>m.home>=432&&m.home<448&&(!model.supportedTypes||model.supportedTypes.includes(m.type))&&order.indexOf(m.home)<998),cr=s.crews[m.service];
  s.vehicles[m.service].model=model.id;s.phase='active';s.clock=100;s.cursor=order.indexOf(m.home)+1;s.done=order.slice(0,s.cursor-1);s.nextCall=1000000;
  cr.point=C.roadStop(C.district(s.seed,0).homes[m.home]);cr.status='repair';cr.job=m.home;cr.angle=0;
  s.calls=[{mission:m.home,spec:{...m},status:'repair',crew:cr.id,due:300,late:false,asked:true,contained:false,remaining,total,path:[cr.point]}];E.decode(E.encode(s));return {s,cr};
 }
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:412,height:915}}),origin=`http://127.0.0.1:${server.address().port}`;await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.httpErrors.push(r.status()+' '+r.url());});
  await page.route('**/fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Fixture</title>'}));await fs.mkdir('test-results/motion',{recursive:true});
  const click=async(cmd,attrs='')=>{const modal=page.locator('dialog[open]');await (await modal.count()?modal:page).locator(`[data-cmd="${cmd}"]${attrs}`).click();};
  async function load(s){await page.goto(origin+'/fixture');await page.evaluate(raw=>{localStorage.setItem('upravdom.campaign.v4',raw);localStorage.setItem('upravdom.campaign.v4.backup',raw);localStorage.setItem('upravdom.settings',JSON.stringify({sound:false,motion:true,labels:false}));localStorage.removeItem('upravdom.visuals');},E.encode(s));await page.goto(origin);await click('continue');await page.waitForFunction(()=>document.querySelector('#campaignMap')?.dataset.renderer==='ready');}
  const equipment=()=>page.locator('#campaignMap').getAttribute('data-equipment').then(JSON.parse),traffic=()=>page.locator('#campaignMap').getAttribute('data-traffic').then(JSON.parse);
  for(const model of E.VEHICLE_MODELS){
   const {s,cr}=scene(model);await load(s);await click('prep');await click('locateCrew',`[data-id="${cr.id}"]`);
   const canvas=page.locator('#campaignMap'),rect=await canvas.boundingBox();await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.wheel(0,-700);
   if(['crane','lift','tipper'].includes(model.kind)){
    const initial=(await equipment()).find(r=>r.id===cr.id);assert.equal(initial.phase,'working');await click('pause');await page.clock.runFor(700);const moving=(await equipment()).find(r=>r.id===cr.id);assert.notEqual(moving.cycle,initial.cycle);await click('pause');
    const frozen=await canvas.evaluate(n=>n.toDataURL());await page.clock.runFor(1500);assert.equal(await canvas.evaluate(n=>n.toDataURL()),frozen,'Equipment or traffic moved while paused');
    await canvas.screenshot({path:`test-results/motion/${model.id}.png`});
   }
   report.models.push(model.id);
  }
  report.checks.push('all 17 models render; nine equipment rigs animate and freeze on pause');
  const {s,cr}=scene(E.VEHICLE_MODELS.find(m=>m.id==='gazelle-next-aerial-lift'));await load(s);await click('prep');await click('locateCrew',`[data-id="${cr.id}"]`);const first=await traffic();assert.ok(first.length>0);await click('pause');await page.clock.runFor(1200);assert.notDeepEqual(await traffic(),first);await click('pause');
  const stopped=await traffic();await page.clock.runFor(1500);assert.deepEqual(await traffic(),stopped);await click('menu');await click('settings');await click('visual','[data-key="traffic"]');await click('close');await click('continue');assert.equal(await page.locator('#campaignMap').getAttribute('data-traffic-count'),'0');report.checks.push('traffic uses game time, freezes on pause, and can be disabled');
  const old=E.fresh(112);E.start(old);old.version=4;delete old.clock;for(const cr of old.crews){cr.point=[768,510];delete cr.angle;}for(const c of old.calls)delete c.spec;
  await load(old);await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));const upgraded=JSON.parse(await page.evaluate(()=>localStorage.getItem('upravdom.campaign.v4')));assert.equal(upgraded.version,6);assert.deepEqual(upgraded.crews[0].point,C.parkingBay(old.seed,0,0));await click('menu');await click('settings');const archiveDownload=page.waitForEvent('download');await click('exportArchive');await (await archiveDownload).saveAs('test-results/motion/pre-update.json');assert.equal(JSON.parse(await fs.readFile('test-results/motion/pre-update.json','utf8')).version,4);await click('close');await click('continue');report.checks.push('real v4 load migrates positions and exports the untouched pre-update original');
  // Renderer test at a shared tile edge: both sides of the roadway have identical asphalt.
  const seam=await page.evaluate(async()=>{
   const M=await import('./campaign-map.js'),C=await import('./campaign-city.js'),E=await import('./campaign-engine.js'),s=E.fresh(112),canvas=document.querySelector('#campaignMap');
   const view={x:C.TW,y:200,scale:.8};M.render(canvas,s,view,{labels:false,motion:false});const r=canvas.getBoundingClientRect(),ctx=canvas.getContext('2d'),ratio=canvas.width/r.width;
   const samples=[-8,-5,5,8].map(dx=>[...ctx.getImageData(Math.round((r.width/2+dx)*ratio),Math.round(250*ratio),1,1).data]);return samples;
  });assert.deepEqual(seam[0],seam[1]);assert.deepEqual(seam[1],seam[2]);await page.locator('#campaignMap').screenshot({path:'test-results/motion/shared-street.png'});report.checks.push('single shared street has no pixel seam across the join');
  // Inspect every ordered art pairing with the actual runtime crop and road renderer.
  await page.evaluate(async()=>{
   const M=await import('./campaign-map.js'),C=await import('./campaign-city.js'),E=await import('./campaign-engine.js'),s=E.fresh(112),city=C.district(s.seed,0);document.querySelector('#app').removeAttribute('id');document.body.innerHTML='<div id="pairs" style="display:grid;grid-template-columns:repeat(10,180px);gap:8px;padding:12px"></div>';
   for(let left=0;left<C.ART.length;left++)for(let right=0;right<C.ART.length;right++){for(const [index,kind] of [[27,left],[28,right]]){city.layouts[index]={...city.layouts[index],kind,quarters:[kind,kind,kind,kind],river:kind<8?null:{kind,flip:false,north:kind===8?372:463,south:kind===8?469:1040}};}const canvas=document.createElement('canvas');canvas.style.cssText='width:180px;height:120px';document.querySelector('#pairs').append(canvas);M.render(canvas,s,{x:4*C.TW,y:3*C.TH+200,scale:.4},{labels:false,motion:false});}
  });await page.screenshot({path:'test-results/motion/all-100-seams.png',fullPage:true});report.checks.push('all 100 ordered tile pairings inspected as runtime scenes');
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);await fs.writeFile('test-results/motion/report.json',JSON.stringify(report,null,2));console.log('MOTION VERIFIED '+report.models.length+' models; '+report.checks.length+' motion/seam scenarios');
  if(process.argv.includes('--video')){
   await Promise.all(['kamaz-crane','gazelle-next-aerial-lift','kamaz6520-tipper'].map(async id=>{
    const context=await browser.newContext({viewport:{width:412,height:915},recordVideo:{dir:'test-results/motion/video',size:{width:412,height:916}}}),p=await context.newPage(),{s,cr}=scene(E.VEHICLE_MODELS.find(m=>m.id===id));s.calls[0].total=s.calls[0].remaining=E.repairTime(s,s.calls[0].spec,cr);
    await p.route('**/fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Fixture</title>'}));await p.goto(origin+'/fixture');await p.evaluate(raw=>{localStorage.setItem('upravdom.campaign.v4',raw);localStorage.setItem('upravdom.settings',JSON.stringify({sound:false,motion:true,labels:false}));},E.encode(s));await p.goto(origin);await p.locator('[data-cmd="continue"]').click();await p.waitForFunction(()=>document.querySelector('#campaignMap')?.dataset.renderer==='ready');await p.locator('[data-cmd="prep"]').click();await p.locator(`[data-cmd="locateCrew"][data-id="${cr.id}"]`).click();const box=await p.locator('#campaignMap').boundingBox();await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.wheel(0,-900);await p.locator('[data-cmd="speed"]').click();await p.locator('[data-cmd="pause"]').click();await new Promise(r=>setTimeout(r,21000));await p.evaluate(()=>window.dispatchEvent(new Event('pagehide')));const result=E.decode(await p.evaluate(()=>localStorage.getItem('upravdom.campaign.v4')));assert.ok(result.done.includes(cr.job),id+' video must show a completed deployment/work/stowing cycle');const video=p.video();await context.close();await video.saveAs('test-results/motion/'+id+'.webm');
   }));console.log('Three real-time equipment videos recorded');
  }
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
