const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const E=await import('../web/campaign-engine.js'),{createServer}=await import('./serve.js'),server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 const checks=[],errors=[];
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:344,height:689}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const click=cmd=>page.locator(`[data-cmd=${cmd}]`).click();
  await click('settings');await click('guide');assert.match(await page.locator('dialog').textContent(),/Первые шаги/);await page.locator('dialog [data-cmd=close]').first().click();
  await click('settings');await click('about');assert.match(await page.locator('dialog').textContent(),/не передаёт сохранения/);await page.locator('dialog [data-cmd=close]').first().click();checks.push('help and privacy work before any company exists');
  await click('new');await click('regionProceed');await page.locator('[data-cmd=sub][data-sub=people]').click();
  await page.locator('[data-cmd=train][data-id="0"]').click();
  let s=E.decode(await page.evaluate(()=>localStorage.getItem('upravdom.campaign.v4')));assert.equal(s.employees[0].level,3);assert.equal(s.money,2976000);checks.push('actual staff training persists cost and skill');
  await click('map');assert.equal(await page.locator('[data-budget]').textContent(),'2 976 000 ₽');
  await click('finance');assert.match(await page.locator('.transactionList').textContent(),/Обучение/);
  await fs.mkdir('test-results/release',{recursive:true});await page.screenshot({path:'test-results/release/finance.png'});checks.push('map budget and financial transactions match the engine');
  const report=E.fresh();E.start(report);for(let i=0;i<80;i++)E.log(report,1000,'Проверенная работа');E.tick(report,480);
  await page.evaluate(raw=>window.dispatchEvent(new CustomEvent('upravdom-import',{detail:raw})),E.encode(report));
  await page.locator('[data-cmd=nextDay]').waitFor();assert.equal(await page.locator('.reportStats>div').count(),4);
  assert.match(await page.locator('.reportStats').textContent(),/80 000 ₽/);await page.screenshot({path:'test-results/release/report.png'});
  await click('nextDay');s=E.decode(await page.evaluate(()=>localStorage.getItem('upravdom.campaign.v4')));assert.equal(s.day,2);checks.push('full shift totals survive ledger truncation and next day');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  await fs.writeFile('test-results/release/report.json',JSON.stringify({checks,errors},null,2));console.log('RELEASE FLOWS VERIFIED '+checks.length+' checks');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
