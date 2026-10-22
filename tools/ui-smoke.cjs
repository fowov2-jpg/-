// Optional browser gate: npm install --no-save playwright; npx playwright install chromium.
// Starts and stops its own local server. CHROMIUM_PATH can select a system browser.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 const {createServer}=await import('./serve.js'),server=createServer();
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:412,height:915},deviceScaleFactor:2});
  await page.clock.install({time:new Date('2026-10-22T08:00:00Z')});
  await page.clock.pauseAt(new Date('2026-10-22T08:00:01Z'));
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const origin=`http://127.0.0.1:${server.address().port}`;
  await page.route('**/save-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Storage fixture</title>'}));
  await page.goto(origin);await page.locator('[data-action="start"]').waitFor();
  await page.evaluate(async()=>{const img=new Image();img.src='/assets/neighborhood.webp';await img.decode();});
  await page.getByRole('button',{name:'Начать смену',exact:true}).click();
  await page.getByRole('button',{name:'Пауза',exact:true}).click();
  for(const id of [1,2,3]){
   await page.locator('[data-tab="calls"]').click();
   await page.locator(`#page [data-action="call"][data-id="${id}"]`).click();
   await page.getByRole('button',{name:'Уточнить обстоятельства'}).click();
   await page.locator('button[data-action="dispatch"]:not([disabled])').click();
   await page.getByRole('button',{name:'Закрыть',exact:true}).click();
  }
  await page.locator('[data-tab="map"]').click();
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();await page.clock.runFor(5000);await page.getByRole('button',{name:'Пауза',exact:true}).click();
  await fs.mkdir('test-results/screenshots',{recursive:true});
  await page.clock.runFor(80);
  await page.screenshot({path:'test-results/screenshots/map-412.png'});
  const money=await page.evaluate(()=>JSON.parse(localStorage.getItem('upravdom.v1')).money);
  assert.equal(money,3000000-6200-3300-2700);
  await page.reload();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('upravdom.v1')).money),money);
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();
  await page.clock.runFor(2000);
  const travelling=await page.evaluate(()=>JSON.parse(localStorage.getItem('upravdom.v1')));
  assert.equal(travelling.minute,7);assert.equal(travelling.crews[0].remaining,travelling.crews[0].total-7);
  await page.getByRole('button',{name:'Пауза',exact:true}).click();
  for(const width of [360,412,560,1200]){
   await page.setViewportSize({width,height:915});
   for(const tab of ['map','calls','services','finance','garage']){
    await page.locator(`[data-tab="${tab}"]`).click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${tab} overflows at ${width}`);
    assert.equal(await page.locator('nav button').count(),5);
    if(width===412){await page.screenshot({path:`test-results/screenshots/${tab}-412.png`,animations:'disabled'});if(process.env.CI&&['map','garage','services'].includes(tab)){const preview=await page.screenshot({type:'jpeg',quality:72,scale:'css',animations:'disabled'});console.log('UPRAVDOM_PREVIEW_'+tab.toUpperCase()+' '+preview.toString('base64'));}}
   }
  }
  await page.setViewportSize({width:412,height:915});
  // Repair completion and end-of-shift report through the UI clock.
  await page.locator('[data-tab="map"]').click();
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();await page.clock.runFor(60000);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('upravdom.v1')).calls.find(c=>c.id===1).status),'done');
  // A dialog and native lifecycle pause must stop both time and auto-saving advancement.
  await page.getByRole('button',{name:'Настройки',exact:true}).click();
  await page.locator('[data-action="setting"][data-key="motion"]').click();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('upravdom.v1')).minute);
  await page.clock.runFor(5000);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('upravdom.v1')).minute),before);
  await page.getByRole('button',{name:'Закрыть',exact:true}).click();
  await page.evaluate(()=>window.dispatchEvent(new Event('upravdom-pause')));
  await page.clock.runFor(5000);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('upravdom.v1')).minute),before);
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();await page.clock.runFor((480-before)*1000);
  await page.getByRole('button',{name:'К следующему дню'}).click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('upravdom.v1')).day),2);
  // Automatic recovery, then explicit preservation when both records are damaged.
  await page.goto(origin+'/save-fixture');await page.evaluate(()=>localStorage.setItem('upravdom.v1','broken'));await page.goto(origin);
  assert.equal(await page.locator('dialog').isVisible(),false);
  await page.locator('[data-tab="garage"]').click();await page.getByRole('button',{name:'Настройки',exact:true}).click();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Экспорт',exact:true}).click();
  const download=await downloadPromise;await download.saveAs('test-results/exported-company.json');
  await page.getByRole('button',{name:'Закрыть',exact:true}).click();
  await page.goto(origin+'/save-fixture');await page.evaluate(()=>{localStorage.setItem('upravdom.v1','broken');localStorage.setItem('upravdom.backup.v1','broken backup');});await page.goto(origin);
  await page.getByRole('heading',{name:'Сохраним ваши данные'}).waitFor();
  await page.getByRole('button',{name:'Закрыть',exact:true}).click();await page.locator('[data-tab="finance"]').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('upravdom.v1')),'broken');
  await page.locator('#importFile').setInputFiles('test-results/exported-company.json');
  await page.getByRole('button',{name:'Восстановить',exact:true}).click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('upravdom.v1')).version),2);
  assert.deepEqual(errors,[]);console.log('UI smoke passed: 5 sections, 4 widths, dispatch, movement, repair, report, next day, backup, export/import.');
 }catch(error){if(browser){const pages=browser.contexts().flatMap(context=>context.pages());if(pages[0]){await fs.mkdir('test-results/screenshots',{recursive:true});await pages[0].screenshot({path:'test-results/screenshots/failure.png',animations:'disabled'}).catch(()=>{});}}throw error;}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
