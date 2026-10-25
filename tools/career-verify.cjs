const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const E=await import('../web/campaign-engine.js'),{createServer}=await import('./serve.js');
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 const report={checks:[],screens:[],errors:[],httpErrors:[]};
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:412,height:915}});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.httpErrors.push(r.status()+' '+r.url());});
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  await fs.mkdir('test-results/career',{recursive:true});
  const click=(cmd,suffix='')=>page.locator(`[data-cmd="${cmd}"]${suffix}`).click();
  const saved=async()=>E.decode(await page.evaluate(()=>localStorage.getItem('upravdom.campaign.v4')));
  const capture=async name=>{
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' overflow');
   await page.screenshot({path:`test-results/career/${name}.png`});report.screens.push(name);
  };
  const pause=async()=>{if(await page.locator('dialog[open]').count())return;if(await page.locator('[data-cmd=pause][aria-label="Пауза"]').count())await click('pause');};
  const resume=async()=>{if(await page.locator('[data-cmd=pause][aria-label="Продолжить время"]').count())await click('pause');};
  const fast=async()=>{for(let i=0;i<3&&await page.locator('[data-cmd=speed]').textContent()!=='4×';i++)await click('speed');};
  let restoredAssistant=false;
  async function duty(){
   await click('start');await fast();let guard=0;
   while((await saved()).phase==='active'&&guard++<65){
    await pause();const s=await saved();
    if(!restoredAssistant&&s.calls.some(c=>c.assistant&&c.assignments.length)){
     const raw=E.encode(s);await page.reload();await click('continue');
     assert.deepEqual((await saved()).calls,E.decode(raw).calls);assert.equal((await saved()).operations.career.assistant.enabled,true);
     assert.equal(await page.locator('[data-cmd=pause]').getAttribute('aria-label'),'Продолжить время');restoredAssistant=true;
     await fast();
    }
    for(const c of (await saved()).calls){
     if(c.channel==='report'&&s.operations.career.assistant.enabled)continue;
     if(c.dialogue==='done'&&!s.crews.some(cr=>!E.reason(s,c,cr)))continue;
     if(await page.locator('[data-cmd=deselect]').count())await click('deselect');
     await click('queue');await click('select',`[data-id="${c.mission}"]`);await click('op-tab','[data-tab="call"]');
     while(await page.locator('[data-cmd=op-answer]').count()){
      const choices=await page.locator('[data-cmd=op-answer]').evaluateAll(ns=>ns.map(n=>n.dataset.choice));
      const choice=['network','scope','source','history','bypass','risk','today','own','branch','close','barrier','cover','notice'].find(p=>choices.includes(p))??choices[0];
      await click('op-answer',`[data-choice="${choice}"]`);
     }
     await click('op-tab','[data-tab="work"][role=tab]');
     while(await page.locator('[data-cmd=op-options]').count()){
      await page.locator('[data-cmd=op-options]').first().click();await page.locator('dialog [data-cmd=op-assign]:not(:disabled)').first().click();
     }
    }
    if(await page.locator('[data-cmd=deselect]').count())await click('deselect');
    await resume();await page.clock.runFor(6000);
   }
   const s=await saved();assert.equal(s.phase,'report');assert.equal(s.report.pending,0);assert.ok(s.report.results.every(r=>r.success));assert.ok(s.operations.shift.peak<=E.Operations.Career.shiftRules(s).concurrent);console.log('Career duty '+s.day+' complete: '+s.report.results.length+' calls, '+s.operations.career.earned+' points');return s;
  }
  await page.goto(`http://127.0.0.1:${server.address().port}`);await click('new');
  assert.match(await page.locator('.districtFacts').textContent(),/2\s*\/\s*99/);assert.equal(await page.locator('.districtZone.locked').count(),19);
  await click('regionProceed');assert.match(await page.locator('.opShiftBrief').textContent(),/3 обращения/);await capture('412-first-duty-budget');
  await click('op-dispatchers');assert.equal(await page.locator('[data-cmd=op-assistant]').isDisabled(),true);await page.locator('dialog [data-cmd=close]').click();
  let s=await duty();assert.equal(s.report.results.length,3);assert.equal(s.operations.shift.peak,1);assert.equal(s.report.career.gained,28);assert.ok(s.money>2900000);await capture('412-first-duty-points');
  report.checks.push('new game starts with two contracts, 99 licensed addresses, three calls and one active incident; report awards points');
  await click('nextDay');s=await duty();assert.ok(s.operations.career.earned>=60);await click('nextDay');
  await click('op-dispatchers');await click('op-assistant');assert.equal(await page.locator('[data-cmd=op-assistant]').getAttribute('aria-pressed'),'true');
  await click('op-autoCrew','[data-id="1"]');assert.equal(await page.locator('[data-cmd=op-autoCrew][data-id="1"]').getAttribute('aria-pressed'),'false');await click('op-autoCrew','[data-id="1"]');
  await capture('412-helper-unlocked');await page.locator('dialog [data-cmd=close]').click();
  s=await duty();assert.ok(s.operations.career.assistant.completed>0);assert.ok(restoredAssistant);assert.ok(E.Operations.canExpand(s));
  report.checks.push('60 earned points unlock the helper; UI enables it and reserves crews; real report assignments survive a reload and complete');
  await click('nextDay');await click('map');await click('finance');const before=E.Operations.Career.points(await saved());
  await click('nextDistrict');s=await saved();assert.equal(s.region,1);assert.equal(E.Operations.Career.points(s),before-100);assert.equal(s.operations.career.areas.length,2);assert.equal(E.Operations.currentHouses(s).length,2);
  await click('op-dispatchers');assert.equal(await page.locator('.opDesk').count(),2);
  for(const width of [344,412,960]){await page.setViewportSize({width,height:width===344?689:915});await capture(width+'-two-district-desks');}
  await page.locator('dialog [data-cmd=close]').click();await page.setViewportSize({width:412,height:915});
  await click('map');await click('addresses');await click('op-licences');assert.equal(await page.locator('.opLicence').count(),99);await capture('412-99-licensed-addresses');await page.locator('dialog [data-cmd=close]').click();
  await click('map');await click('prep');s=await duty();const desk=s.operations.career.areas[0];assert.ok(desk.handled>0);assert.equal(desk.lastReport.completed,desk.lastReport.total);assert.ok(s.money>0);await capture('412-second-district-report');
  report.checks.push('100 points open a second 99-address district; previous houses retain their own dispatcher, whose jobs complete during the next duty');
  report.checks.push('344/412/960 dispatcher dialogs and the 99-address list remain within the original interface');
  const big=E.freshCompany(),base=structuredClone(big.operations.houses[0]);big.region=19;
  big.operations.houses=Array.from({length:20},(_,region)=>Array.from({length:99},(_,id)=>({...structuredClone(base),id,region,history:Array.from({length:12},()=>({day:1,text:'Районный диспетчер: протечка устранена, подача воды восстановлена. Доступ в подвал проверен.'}))}))).flat();
  big.operations.career.earned=20000;big.operations.career.spent=7030;big.operations.career.areas=Array.from({length:20},(_,region)=>({region,openedDay:1,points:1000,handled:0,shift:null,lastReport:null}));
  for(const cr of big.crews)cr.point=E.Operations.parkingPosition(big,cr.id);
  await page.evaluate(raw=>window.dispatchEvent(new CustomEvent('upravdom-import',{detail:raw})),E.encode(big));
  assert.equal((await saved()).operations.houses.length,1980);
  await click('menu');assert.equal(await page.evaluate(()=>localStorage.getItem('upravdom.campaign.v4').startsWith('UD8P1:')),true);
  const storageBytes=await page.evaluate(()=>2*(localStorage.getItem('upravdom.campaign.v4').length+localStorage.getItem('upravdom.campaign.v4.backup').length));assert.ok(storageBytes<5000000);
  await page.reload();await click('continue');assert.equal((await saved()).operations.houses.length,1980);assert.match(await page.locator('.districtFacts').textContent(),/99\s*\/\s*99/);
  report.storage={houses:1980,primaryAndBackupBytes:storageBytes,exportBytes:Buffer.byteLength(E.encode(big),'utf8')};
  report.checks.push('a full 20 by 99 portfolio with 12 history entries per house fits real browser primary and backup storage, reloads and remains exportable as plain JSON');
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);await fs.writeFile('test-results/career/report.json',JSON.stringify(report,null,2));console.log('CAREER VERIFIED '+report.checks.length+' flows; '+report.screens.length+' screens; no JS or HTTP errors');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
