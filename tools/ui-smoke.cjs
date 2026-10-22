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
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:412,height:915},deviceScaleFactor:2});
  await page.clock.install({time:new Date('2026-10-22T08:00:00Z')});
  await page.clock.pauseAt(new Date('2026-10-22T08:00:01Z'));
  const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&/THREE|shader|WebGL/i.test(message.text()))errors.push(message.text());});
  const origin=`http://127.0.0.1:${server.address().port}`;
  await page.route('**/save-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Storage fixture</title>'}));
  await page.goto(origin);await page.locator('[data-action="start"]').waitFor();
  await page.waitForFunction(()=>document.querySelector('#map').dataset.renderer==='illustrated'&&document.querySelector('#map').dataset.vehicles==='ready');
  await page.locator('[data-tab="services"]').click();await page.locator('.segmented [data-action="subpage"][data-sub="hire"]').click();
  const candidateIds=await page.evaluate(()=>JSON.parse(localStorage.getItem('upravdom.v1')||'null')?.candidates?.filter(c=>c.service===0).map(c=>c.id)||[100,101]);
  for(const id of candidateIds)await page.locator(`[data-action="hire"][data-id="${id}"]`).click();
  await page.locator('[data-tab="garage"]').click();await page.locator('.segmented [data-action="subpage"][data-sub="buy"]').click();await page.locator('[data-action="buyVehicle"][data-model="van"]').click();
  await page.locator('[data-tab="services"]').click();await page.locator('.segmented [data-action="subpage"][data-sub="crews"]').click();await page.locator('[data-action="newCrew"]').click();
  await page.locator('#crew-person-1').selectOption('6');await page.locator('#crew-person-2').selectOption('7');await page.locator('#crew-vehicle').selectOption('3');await page.locator('[data-action="formCrew"]').click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('upravdom.v1')).crews.length),4);
  await page.locator('[data-tab="finance"]').click();await page.locator('.segmented [data-action="subpage"][data-sub="contracts"]').click();await page.locator('[data-action="acceptContract"][data-id="3"]').click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('upravdom.v1')).homes.filter(h=>h.active).length),4);
  await page.locator('[data-tab="garage"]').click();await page.locator('.segmented [data-action="subpage"][data-sub="stock"]').click();await page.locator('#stock-qty-0').selectOption('10');await page.locator('[data-action="orderParts"][data-part="0"][data-express="false"]').click();
  const expectedMoney=await page.evaluate(()=>JSON.parse(localStorage.getItem('upravdom.v1')).money);
  await page.locator('[data-tab="map"]').click();

  await page.getByRole('button',{name:'Начать смену',exact:true}).click();
  await page.getByRole('button',{name:'Пауза',exact:true}).click();
  for(const id of [1,2,3]){
   await page.locator('[data-tab="calls"]').click();
   await page.locator(`#page [data-action="call"][data-id="${id}"]`).click();
   await page.getByRole('button',{name:'Уточнить обстоятельства'}).click();
   await page.locator('button[data-action="dispatch"]:not([disabled])').first().click();
   await page.getByRole('button',{name:'Закрыть',exact:true}).click();
  }
  await page.locator('[data-tab="map"]').click();
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();await page.clock.runFor(5000);await page.getByRole('button',{name:'Пауза',exact:true}).click();
  await fs.mkdir('test-results/screenshots',{recursive:true});
  await page.clock.runFor(80);
  await page.screenshot({path:'test-results/screenshots/map-412.png'});
  const money=await page.evaluate(()=>JSON.parse(localStorage.getItem('upravdom.v1')).money);
  assert.equal(money,expectedMoney);
  await page.reload();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('upravdom.v1')).money),money);
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();
  await page.clock.runFor(2000);
  const travelling=await page.evaluate(()=>JSON.parse(localStorage.getItem('upravdom.v1')));
  assert.equal(travelling.minute,7);assert.equal(travelling.crews[0].remaining,travelling.crews[0].total-7);
  await page.getByRole('button',{name:'Пауза',exact:true}).click();
  for(const width of [360,412,560,1200]){
   await page.setViewportSize({width,height:915});
   for(const tab of ['map','calls','services','finance','garage']){
    await page.locator(`[data-tab="${tab}"]`).click();if(tab==='garage')await page.locator('.segmented [data-action="subpage"][data-sub="fleet"]').click();if(tab==='finance')await page.locator('.segmented [data-action="subpage"][data-sub="overview"]').click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${tab} overflows at ${width}`);
    assert.equal(await page.locator('nav button').count(),5);
    const layout=await page.evaluate(()=>{const m=document.querySelector('.headerBudget').getBoundingClientRect(),c=document.querySelector('.headerClock').getBoundingClientRect(),n=document.querySelector('#nav').getBoundingClientRect();return {separate:m.right<=c.left+1,bottom:n.bottom,height:innerHeight,inside:[...document.querySelectorAll('#nav button')].every(b=>{const r=b.getBoundingClientRect();return r.top>=n.top&&r.bottom<=innerHeight+1;})};});
    assert.ok(layout.separate,`Money and clock overlap at ${width}`);assert.ok(layout.bottom<=layout.height+1&&layout.inside,`Bottom controls leave viewport at ${width}`);

    if(tab==='map'){
     const pad=await page.locator('.districtExpansion').boundingBox();
     assert.ok(pad&&pad.x>=0&&pad.x+pad.width<=width+1,`Expansion controls outside viewport at ${width}`);
     for(const direction of ['mapWest','mapNorth','mapSouth','mapEast'])
      assert.equal(await page.locator('[data-action="'+direction+'"]').count(),1,`Missing ${direction}`);
     const bounds=await page.locator('#map').boundingBox();
     for(const id of [0,1,2,3]){const label=await page.locator(`.mapLabels [data-action="home"][data-id="${id}"]`).boundingBox();assert.ok(label&&label.x>=bounds.x&&label.x+label.width<=bounds.x+bounds.width,`Starting home ${id} clipped at ${width}`);}
    }
    if(width===412){await page.screenshot({path:`test-results/screenshots/${tab}-412.png`,animations:'disabled'});if(process.env.CI&&['map','garage','services'].includes(tab)){const preview=await page.screenshot({type:'jpeg',quality:72,scale:'css',animations:'disabled'});console.log('UPRAVDOM_PREVIEW_'+tab.toUpperCase()+' '+preview.toString('base64'));}}
   }
  }
  await page.setViewportSize({width:412,height:915});
  await page.locator('[data-tab="map"]').click();
  for(let zoom=0;zoom<8;zoom++)await page.locator('[data-action="zoomOut"]').click();
  const bounds=await page.locator('#map').boundingBox();
  for(const delta of [-1,1]){
   await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(bounds.x+(delta<0?4:bounds.width-4),bounds.y+(delta<0?4:bounds.height-4),{steps:8});await page.mouse.up();
   const coverage=await page.locator('#map').getAttribute('data-coverage').then(JSON.parse);assert.ok(coverage.left<=0&&coverage.top<=0&&coverage.right>=bounds.width-1&&coverage.bottom>=bounds.height-1,'Map edge exposed');
  }
  await page.locator('[data-action="center"]').click();
  const camera=()=>page.locator('#map').getAttribute('data-coverage').then(JSON.parse);
  const baseCamera=await camera();
  await page.locator('[data-action="mapNorth"]').click();
  assert.ok((await camera()).y>baseCamera.y,'Up arrow did not move camera north');
  await page.locator('[data-action="mapSouth"]').click();
  await page.locator('[data-action="mapWest"]').click();
  assert.ok((await camera()).x>baseCamera.x,'Left arrow did not move camera west');
  await page.locator('[data-action="mapEast"]').click();
  await page.locator('[data-action="previewMore"]').click();
  assert.equal(await page.locator('#map').getAttribute('data-planned-homes'),'48');
  await page.locator('[data-action="previewLess"]').click();
  await page.locator('[data-action="center"]').click();
  await page.locator('.mapLabels [data-action="home"][data-id="0"]').click();await page.getByRole('heading',{name:'ул. Садовая, 12',exact:true}).waitFor();await page.getByRole('button',{name:'Закрыть',exact:true}).click();
  // Repair completion and end-of-shift report through the UI clock.
  await page.locator('[data-tab="map"]').click();
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();await page.locator('[data-action="speed"]').click();await page.locator('[data-action="speed"]').click();await page.clock.runFor(15000);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('upravdom.v1')).calls.find(c=>c.id===1).status),'done');
  // A dialog and native lifecycle pause must stop both time and auto-saving advancement.
  await page.getByRole('button',{name:'Настройки',exact:true}).click();
  await page.locator('[data-action="setting"][data-key="motion"]').click();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('upravdom.v1')).minute);
  await page.clock.runFor(5000);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('upravdom.v1')).minute),before);
  await page.getByRole('button',{name:'Закрыть',exact:true}).click();
  await page.evaluate(()=>window.dispatchEvent(new Event('upravdom-pause')));
  await page.clock.runFor(5000);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('upravdom.v1')).minute),before);
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();await page.clock.runFor(Math.ceil((480-before)/4)*1000);
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
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('upravdom.v1')).version),3);
  assert.deepEqual(errors,[]);console.log('UI smoke passed: detailed district artwork, realistic vehicle atlas, constrained map camera, hiring, vehicle purchase, crew assembly, contract expansion, warehouse orders, 5 sections, 4 widths, full shift, backup and import/export.');
 }catch(error){if(browser){const pages=browser.contexts().flatMap(context=>context.pages());if(pages[0]){await fs.mkdir('test-results/screenshots',{recursive:true});await pages[0].screenshot({path:'test-results/screenshots/failure.png',animations:'disabled'}).catch(()=>{});if(process.env.CI){const preview=await pages[0].screenshot({type:'jpeg',quality:72,scale:'css',animations:'disabled'}).catch(()=>null);if(preview)console.log('UPRAVDOM_PREVIEW_FAILURE '+preview.toString('base64'));}}}throw error;}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
