const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const E=await import('../web/campaign-engine.js'),C=await import('../web/campaign-city.js'),{createServer}=await import('./serve.js');
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 const errors=[],checks=[];
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:360,height:800}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.locator('.campaignMenu').waitFor();
  const click=cmd=>page.locator(`[data-cmd="${cmd}"]`).click();
  const imported=async s=>{
   await page.evaluate(raw=>window.dispatchEvent(new CustomEvent('upravdom-import',{detail:raw})),E.encode(s));
  };
  const saved=()=>page.evaluate(()=>localStorage.getItem('upravdom.campaign.v4'));
  const s=E.fresh(112);E.start(s);await imported(s);
  await page.locator('#campaignMap').waitFor();
  assert.equal(await page.locator('[data-cmd="pause"]').getAttribute('aria-label'),'Продолжить время');
  await click('calls');await page.locator('[data-cmd="select"]').first().click();await click('assign');
  const eligible=page.locator('[data-cmd="dispatch"]:not([disabled])');assert.ok(await eligible.count()>0);
  await eligible.first().click();await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  const dispatched=E.decode(await saved());assert.ok(dispatched.crews.some(c=>c.status==='travel'));
  checks.push('active import resumes paused and accepts a real ranked crew assignment');
  const report=E.fresh(314);E.start(report);E.tick(report,480);await imported(report);
  await page.locator('[data-cmd="nextDay"]').waitFor();await click('nextDay');
  assert.equal(E.decode(await saved()).day,2);await page.locator('.campaignTabs').waitFor();
  checks.push('report import opens shift results and advances to the next day');
  const previous=await saved();
  await page.evaluate(()=>{
   const write=Storage.prototype.setItem;
   Storage.prototype.setItem=function(key,value){if(key==='upravdom.campaign.v4')throw new DOMException('Storage full','QuotaExceededError');return write.call(this,key,value);};
   window.restoreWrites=()=>Storage.prototype.setItem=write;
  });
  await imported(E.fresh(999));assert.equal(await saved(),previous);
  assert.match(await page.locator('#toast').textContent(),/Импорт не выполнен/);
  await page.evaluate(()=>window.restoreWrites());await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  assert.equal(E.decode(await saved()).seed,314);
  checks.push('storage write failure preserves the running company and primary save');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('upravdom-import',{detail:'broken'})));
  assert.equal(await saved(),previous);assert.match(await page.locator('#toast').textContent(),/Импорт не выполнен/);
  checks.push('invalid import preserves previous progress');
  const completed=E.fresh(112);completed.cursor=999;completed.done=C.missionOrder(completed.seed,0);completed.phase='cleared';
  await imported(completed);await page.locator('[data-cmd=nextDistrict]').waitFor();await click('nextDistrict');
  assert.equal(E.decode(await saved()).region,1);
  const won=E.fresh(112);won.region=19;won.cursor=999;won.done=C.missionOrder(won.seed,19);won.phase='won';
  await imported(won);assert.match(await page.locator('dialog[open]').textContent(),/Город под управлением/);
  await page.locator('dialog [data-cmd=menu]').click();await imported(E.fresh(314));
  checks.push('completed district and final campaign imports expose their correct progression');
  await click('settings');assert.match(await page.locator('dialog').textContent(),/0\.8\.2-rc\.1/);await click('close');
  for(const width of [360,412,1200]){
   await page.setViewportSize({width,height:800});await click('map');
   await page.locator('#campaignMap[data-renderer="ready"]').waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await fs.mkdir('test-results/operator',{recursive:true});await page.screenshot({path:`test-results/operator/map-${width}.png`});
   await click('prep');
  }
  checks.push('map fits mobile and desktop viewports');assert.deepEqual(errors,[]);
  await fs.writeFile('test-results/operator/report.json',JSON.stringify({checks,errors},null,2));
  console.log('OPERATOR VERIFIED '+checks.length+' flows; no JS errors');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
