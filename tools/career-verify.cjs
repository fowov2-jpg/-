const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const E=await import('../web/campaign-engine.js'),T=await import('../web/territory-progression.js'),{createServer}=await import('./serve.js');
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 const report={checks:[],screens:[],errors:[],httpErrors:[]};
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:412,height:915}});await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.httpErrors.push(r.status()+' '+r.url());});await fs.mkdir('test-results/career',{recursive:true});
  const click=(cmd,suffix='')=>page.locator(`[data-cmd="${cmd}"]${suffix}`).click();
  const saved=async()=>E.decode(await page.evaluate(()=>localStorage.getItem('upravdom.campaign.v4')));
  const capture=async name=>{
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' overflow');
   const clipped=await page.locator('.workerTile strong,.crewHeadingName strong,.territoryDistrict h3,.objectiveTitle h3').evaluateAll(ns=>ns.filter(n=>n.scrollWidth>n.clientWidth+2).map(n=>n.textContent));assert.deepEqual(clipped,[],name+' clips text');
   await page.screenshot({path:`test-results/career/${name}.png`});report.screens.push(name);
  };
  const pause=async()=>{if(await page.locator('dialog[open]').count())return;if(await page.locator('[data-cmd=pause][aria-label="Пауза"]').count())await click('pause');};
  const resume=async()=>{if(await page.locator('[data-cmd=pause][aria-label="Продолжить время"]').count())await click('pause');};
  const fast=async()=>{for(let i=0;i<3&&await page.locator('[data-cmd=speed]').textContent()!=='4×';i++)await click('speed');};
  let restoredAssistant=false;
  async function duty(){
   await click('start');await fast();let guard=0;
   while((await saved()).phase==='active'&&guard++<70){
    await pause();const s=await saved();
    if(!restoredAssistant&&s.calls.some(c=>c.assistant&&c.assignments.length)){
     const calls=structuredClone(s.calls);await page.reload();await click('continue');assert.deepEqual((await saved()).calls,calls);assert.equal((await saved()).operations.career.assistant.enabled,true);restoredAssistant=true;await fast();
    }
    for(const c of (await saved()).calls){
     if(c.channel==='report'&&s.operations.career.assistant.enabled)continue;
     if(c.dialogue==='done'&&!s.crews.some(cr=>!E.reason(s,c,cr)))continue;
     if(await page.locator('[data-cmd=deselect]').count())await click('deselect');
     await click('queue');await click('select',`[data-id="${c.mission}"]`);await click('op-tab','[data-tab="call"]');
     while(await page.locator('[data-cmd=op-answer]').count()){
      const choices=await page.locator('[data-cmd=op-answer]').evaluateAll(ns=>ns.map(n=>n.dataset.choice));
      const choice=['network','scope','source','history','bypass','risk','today','branch','close','barrier','cover','notice','priority','local','clear','own'].find(p=>choices.includes(p))??choices[0];await click('op-answer',`[data-choice="${choice}"]`);
     }
     await click('op-tab','[data-tab="work"][role=tab]');
     while(await page.locator('[data-cmd=op-options]').count()){
      await page.locator('[data-cmd=op-options]').first().click();await page.locator('dialog [data-cmd=op-assign]:not(:disabled)').first().click();
     }
    }
    if(await page.locator('[data-cmd=deselect]').count())await click('deselect');await resume();await page.clock.runFor(6000);
   }
   const s=await saved();assert.equal(s.phase,'report');assert.equal(s.report.pending,0);assert.ok(s.report.results.every(r=>r.success));assert.ok(s.operations.shift.peak<=E.Operations.Career.shiftRules(s).concurrent);console.log('Regional duty '+s.day+': '+s.report.results.length+' calls, '+s.operations.career.earned+' points');return s;
  }
  await page.goto(`http://127.0.0.1:${server.address().port}`);await capture('412-menu');await click('new');assert.match(await page.locator('.districtFacts').textContent(),/3\s*\/\s*999/);assert.equal(await page.locator('.districtZone.locked').count(),19);await capture('412-areas');
  await click('regionProceed');assert.match(await page.locator('.opShiftBrief').textContent(),/3 обращения/);await capture('412-first-duty-budget');await click('sub','[data-sub=dispatchers]');assert.equal(await page.locator('[data-cmd=op-assistant]').isDisabled(),true);await click('sub','[data-sub=crews]');
  let s=await duty();assert.equal(s.report.results.length,3);assert.equal(s.operations.shift.peak,1);assert.equal(s.report.career.gained,38);assert.ok(s.money>3000000);await capture('412-first-duty-points');report.checks.push('actual new game: three houses, 999-address area, 60-address district, three first-duty calls, positive money and one-time objective');
  await click('nextDay');s=await duty();assert.ok(s.operations.career.earned>=60);await click('nextDay');await click('sub','[data-sub=dispatchers]');await click('op-assistant');assert.equal(await page.locator('[data-cmd=op-assistant]').getAttribute('aria-pressed'),'true');
  await click('op-autoCrew','[data-id="1"]');assert.equal(await page.locator('[data-cmd=op-autoCrew][data-id="1"]').getAttribute('aria-pressed'),'false');await click('op-autoCrew','[data-id="1"]');await capture('412-dispatchers');
  await click('map');assert.equal(await page.locator('[data-cmd=op-dispatchers]').count(),0);await click('plan');const points=T.balance(await saved());await click('op-openDistrict');s=await saved();assert.equal(s.region,0);assert.equal(T.current(s),1);assert.equal(T.balance(s),points-80);assert.equal(s.operations.houses.length,6);assert.equal(E.Operations.currentHouses(s).length,3);
  s=await duty();assert.ok(s.operations.career.assistant.completed>0);assert.ok(restoredAssistant);assert.equal(T.desks(s)[0].district.lastReport.completed,T.desks(s)[0].district.lastReport.total);report.checks.push('two duties open a second district; helper settings, active report restore, old contracts and real background jobs persist');await click('nextDay');await click('map');
  assert.deepEqual(await page.locator('.campaignBottom .navLabel').allTextContents(),['Меню','Заявки','Бригады','План','Финансы']);
  for(const width of [344,412,960]){
   await page.setViewportSize({width,height:width===344?689:915});await page.locator('#campaignMap[data-renderer=ready]').waitFor();await capture(width+'-mobile-map');
   const overlap=await page.locator('.opCommandBar').evaluate(n=>{const a=[...n.children].map(c=>c.getBoundingClientRect());return a.some((b,i)=>i&&b.left<a[i-1].right-1);});assert.equal(overlap,false,'command controls overlap');
   await click('op-locateCrew','[data-id="0"]');assert.equal(await page.locator('[data-cmd=op-crew][data-id="0"]').getAttribute('aria-pressed'),'true');await click('prep');await click('sub','[data-sub=dispatchers]');await capture(width+'-district-desks');await click('sub','[data-sub=fleet]');await click('catalog');await click('fleet-filter','[data-kind=lift]');assert.equal(await page.locator('.fleetCatalogueCard').count(),3);const imageOverlap=await page.locator('.fleetCatalogueCard').evaluateAll(ns=>ns.some(n=>n.querySelector('.vehiclePhoto').getBoundingClientRect().right>n.lastElementChild.getBoundingClientRect().left+1));assert.equal(imageOverlap,false,'catalogue image overlaps vehicle specifications');await capture(width+'-lift-catalog');await click('catalog');
   await click('map');await click('plan');await click('territory-tab','[data-tab=districts]');await capture(width+'-districts');await click('territory-tab','[data-tab=goals]');await capture(width+'-goals');await click('territory-tab','[data-tab=houses]');await click('op-licences');assert.equal(await page.locator('.opLicence').count(),60);await capture(width+'-60-addresses');await page.locator('dialog [data-cmd=close]').click();await click('map');
  }
  report.checks.push('344/412/960: command bar, five navigation items, crew rail, dispatcher tab, lift models, objectives and 60-address district list');
  const old=E.freshCompany(808);E.start(old);E.dispatch(old,old.calls[0].mission,1);E.tick(old,3);const oldRaw=E.encode(old);await page.evaluate(raw=>window.dispatchEvent(new CustomEvent('upravdom-import',{detail:raw})),oldRaw);s=await saved();assert.equal(s.version,9);assert.equal(s.operations.territory.transition,true);assert.deepEqual(s.calls,old.calls);assert.equal(await page.evaluate(()=>localStorage.getItem('upravdom.campaign.v4.before-v9')),oldRaw);
  const valid=await page.evaluate(()=>localStorage.getItem('upravdom.campaign.v4'));await page.evaluate(()=>window.dispatchEvent(new CustomEvent('upravdom-import',{detail:'broken'})));assert.equal(await page.evaluate(()=>localStorage.getItem('upravdom.campaign.v4')),valid);report.checks.push('v8 active route migrates intact and archives its exact source; malformed import keeps the current company');
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);await fs.writeFile('test-results/career/report.json',JSON.stringify(report,null,2));console.log('REGIONAL CAREER VERIFIED '+report.checks.length+' flows; '+report.screens.length+' screens');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
