// End-to-end acceptance of the new dispatch story. The first shift is played
// through visible controls; fixtures are used separately for restoration/layout.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const E=await import('../web/campaign-engine.js'),{createServer}=await import('./serve.js');
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 const report={checks:[],screens:[],errors:[],httpErrors:[],unusedDistrictRequests:[]};
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:412,height:915}}),origin=`http://127.0.0.1:${server.address().port}`;
  page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.httpErrors.push(r.status()+' '+r.url());});
  page.on('request',r=>{if(r.url().includes('/assets/districts/'))report.unusedDistrictRequests.push(r.url());});
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  await fs.mkdir('test-results/operations',{recursive:true});
  const click=(cmd,suffix='')=>page.locator(`[data-cmd="${cmd}"]${suffix}`).click();
  const saved=async()=>E.decode(await page.evaluate(()=>localStorage.getItem('upravdom.campaign.v4')));
  const pause=async()=>{if(await page.locator('dialog[open]').count())return;if(await page.locator('[data-cmd=pause][aria-label="Пауза"]').count())await click('pause');};
  const resume=async()=>{if(await page.locator('[data-cmd=pause][aria-label="Продолжить время"]').count())await click('pause');};
  const capture=async name=>{
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' viewport overflow');
   const clipped=await page.locator('.opIncidentHeader h3,.opCrewInfo strong,.opServiceRow strong,.opMapBudget b').evaluateAll(ns=>ns.filter(n=>n.scrollWidth>n.clientWidth+2).map(n=>n.textContent));
   assert.deepEqual(clipped,[],name+' clipped text');
   await page.screenshot({path:`test-results/operations/${name}.png`});report.screens.push(name);
  };
  await page.goto(origin);await click('new');await capture('412-brief');await click('regionProceed');
  assert.equal(await page.locator('.opCrewRow').count(),3);await capture('412-crews');
  await click('op-equipment','[data-id="2"]');await click('op-equip','[data-kit="repair-pump"]');await page.locator('dialog [data-cmd=close]').click();
  assert.equal((await saved()).money,2964000);await click('start');
  assert.equal((await saved()).calls.length,1);assert.equal(await page.locator('[data-cmd=pause]').getAttribute('aria-label'),'Продолжить время');
  await capture('412-first-call');
  await click('speed');await click('speed');
  let floodScreenshot=false,guard=0;
  while((await saved()).phase==='active'&&guard++<50){
   await pause();let s=await saved();
   for(const c of s.calls){
    if(c.deferred||c.dialogue==='done'&&!s.crews.some(cr=>!E.reason(s,c,cr)))continue;
    if(await page.locator('[data-cmd=deselect]').count())await click('deselect');
    await click('queue');await click('select',`[data-id="${c.mission}"]`);
    await click('op-tab','[data-tab="call"]');
    while(await page.locator('[data-cmd=op-answer]').count()){
     const choices=await page.locator('[data-cmd=op-answer]').evaluateAll(ns=>ns.map(n=>n.dataset.choice));
     const preferred=['network','scope','source','history','bypass','risk','today','own','branch','close','barrier','cover','notice'];
     const choice=preferred.find(p=>choices.includes(p))??choices[0];await click('op-answer',`[data-choice="${choice}"]`);
    }
    await click('op-tab','[data-tab="work"][role=tab]');
    while(await page.locator('[data-cmd=op-options]').count()){await page.locator('[data-cmd=op-options]').first().click();await page.locator('dialog [data-cmd=op-assign]:not(:disabled)').first().click();}
    if(c.kind==='flood'&&!floodScreenshot){
      assert.equal((await saved()).calls.find(v=>v.mission===c.mission).assignments.length,3);
      await capture('412-flood-dispatch');floodScreenshot=true;
    }
   }
   if(await page.locator('[data-cmd=deselect]').count())await click('deselect');
   await resume();await page.clock.runFor(10000);await pause();
  }
  let s=await saved();assert.equal(s.phase,'report','first shift reached report through browser time');
  assert.equal(s.report.results.filter(r=>r.success).length,8);assert.equal(s.report.pending,0);assert.ok(s.report.waterMinutes>0);assert.ok(s.report.compensation>0);
  assert.ok(s.report.results.some(r=>r.kind==='flood'&&r.success));assert.ok(s.report.decisions.length>=8);
  await capture('412-report');report.checks.push('complete authored first shift: conversations, 3-service flood, dependency waits, restoration, monetary and house consequences');
  await click('nextDay');await click('map');await click('addresses');
  await page.locator('[data-cmd=op-house]').first().click();
  assert.match(await page.locator('dialog').textContent(),/История дома/);await page.locator('[data-cmd=op-prevent]:not(:disabled)').first().click();
  await page.locator('dialog [data-cmd=close]').click();await page.locator('[data-cmd=op-sign]:not(:disabled)').first().click();
  s=await saved();assert.equal(s.operations.houses.length,4);assert.ok(s.operations.houses.some(h=>Object.values(h.prevention).includes(4)));
  await capture('412-houses');report.checks.push('next day retains house history, pays for prevention and accepts a fourth contract');
  await click('map');await click('prep');await page.locator('[data-cmd=sub][data-sub=people]').click();await click('train','[data-id="0"]');
  assert.equal((await saved()).employees[0].level,3);await click('map');await click('finance');assert.match(await page.locator('.transactionList').textContent(),/Обучение/);await capture('412-company');
  await page.reload();await click('continue');assert.equal((await saved()).operations.houses.length,4);assert.equal((await saved()).employees[0].level,3);
  report.checks.push('company management, autosave, reload and continue preserve the updated game');

  // A running linked incident survives an export/import boundary with all three
  // participants and unfinished stage dependencies. It is never flattened to v6.
  const fixture=E.freshCompany(112);E.start(fixture);fixture.calls=[];fixture.cursor=0;fixture.done=[];fixture.operations.planIndex=8;
  const flood=E.Operations.issue(fixture,'flood',fixture.operations.houses[1].id);E.answer(fixture,0,'risk');E.answer(fixture,0,'local');
  for(const cr of fixture.crews)E.dispatch(fixture,0,cr.id);E.tick(fixture,23);
  for(const width of [344,412,960]){
    await page.setViewportSize({width,height:width===344?689:915});
    await page.evaluate(raw=>window.dispatchEvent(new CustomEvent('upravdom-import',{detail:raw})),E.encode(fixture));
    await click('queue');await click('select','[data-id="0"]');await click('op-tab','[data-tab="work"][role=tab]');
    await capture(width+'-linked-incident');
    const restored=await saved();assert.deepEqual(restored.calls[0].work,fixture.calls[0].work);assert.deepEqual(restored.calls[0].assignments,fixture.calls[0].assignments);
    const sheet=await page.locator('.opIncident').boundingBox(),rack=await page.locator('.opDispatchBase').boundingBox();assert.ok(sheet.y+sheet.height<=rack.y+2,'incident sheet covers crew rack');
    const queue=await page.locator('.opIncoming').boundingBox();assert.ok(sheet.y>=queue.y+queue.height-1,'incident sheet covers queue');
    await click('deselect');await click('op-focus','.opFocus');await capture(width+'-operational-map');
    const canvas=await page.locator('#campaignMap').boundingBox(),before=JSON.parse(await page.locator('#campaignMap').getAttribute('data-camera'));
    await page.mouse.move(canvas.x+canvas.width/2,canvas.y+canvas.height/2);await page.mouse.down();await page.mouse.move(canvas.x+canvas.width/2-40,canvas.y+canvas.height/2-40,{steps:5});await page.mouse.up();
    const after=JSON.parse(await page.locator('#campaignMap').getAttribute('data-camera'));assert.notEqual(before.x,after.x);
  }
  report.checks.push('344/412/960 layouts, clear crew rack, real map gestures, and mid-incident import preserve routes, participants and dependencies');
  const quick=E.freshCompany(112);E.start(quick);
  await page.setViewportSize({width:412,height:915});
  await page.evaluate(raw=>window.dispatchEvent(new CustomEvent('upravdom-import',{detail:raw})),E.encode(quick));
  await click('op-crew','[data-id="1"]');
  const marker=JSON.parse(await page.locator('#campaignMap').getAttribute('data-markers')).find(m=>m.kind==='call'&&m.id===0),bounds=await page.locator('#campaignMap').boundingBox();
  await page.mouse.click(bounds.x+marker.x+marker.w/2,bounds.y+marker.y+marker.h/2);
  assert.equal((await saved()).calls[0].assignments[0].crew,1);assert.equal(await page.locator('[data-cmd=pause]').getAttribute('aria-label'),'Продолжить время');
  report.checks.push('selecting a crew then tapping the real incident marker dispatches it and preserves planning pause');
  const valid=await page.evaluate(()=>localStorage.getItem('upravdom.campaign.v4'));
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('upravdom-import',{detail:'broken'})));assert.equal(await page.evaluate(()=>localStorage.getItem('upravdom.campaign.v4')),valid);
  report.checks.push('invalid v7 import leaves the running company and saved progress intact');
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);assert.deepEqual(report.unusedDistrictRequests,[],'operational map unnecessarily decodes old district backgrounds');
  await fs.writeFile('test-results/operations/report.json',JSON.stringify(report,null,2));console.log('DISPATCH STORY VERIFIED '+report.checks.length+' flows; '+report.screens.length+' screens; no JS or HTTP errors');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
