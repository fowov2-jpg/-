// Optional browser gate. Install playwright and Chromium before running.
// Start npm start before node tools/ui-smoke.cjs.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:412,height:915},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4173',{waitUntil:'networkidle'});
  // Binary assets must really be served, not just described in an asset manifest.
  const sprites=['house_01.png','house_02.png','house_03.png','house_04.png',
    'van_water.png','van_electric.png','van_repair.png',
    ...['water','electric','repair'].flatMap(service=>['north','west','south'].map(dir=>'van_'+service+'_'+dir+'.png')),
    'tree_green.png','tree_autumn.png','tree_pine.png'];
  for(const name of sprites){
   const response=await page.request.get('http://localhost:4173/assets/rendered/'+name);
   assert.equal(response.status(),200,'Sprite must exist: '+name);
   const bytes=await response.body();
   assert.ok(bytes.length>5000,'Sprite cannot be empty: '+name);
   assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a','Valid PNG: '+name);
  }

  fs.mkdirSync('artifacts',{recursive:true});
  await page.waitForTimeout(500);
  await page.screenshot({path:'artifacts/upravdom-map-prep-412.png'});
  await page.getByRole('button',{name:'Начать смену',exact:true}).click();
  await page.getByRole('button',{name:'Пауза',exact:true}).click();
  await page.locator('button[data-action="call"]').first().click();
  await page.getByRole('button',{name:'Уточнить обстоятельства'}).click();
  await page.locator('button[data-action="dispatch"]:not([disabled])').click();
  await page.getByRole('button',{name:'Закрыть',exact:true}).click();
  const money=async()=>String(await page.locator('header .money').innerText()).replace(/[^0-9]/g,'');
  assert.equal(await money(),'2993800','Materials deducted once');
  fs.mkdirSync('artifacts',{recursive:true});
  await page.locator('#toast').waitFor({state:'hidden'});
  await page.waitForTimeout(1100); // Let asynchronously loaded 3D sprite images settle.
  await page.screenshot({path:'artifacts/upravdom-map-412.png'});
  assert.ok(await page.evaluate(()=>document.querySelector('#map').width>0),'Map redraws after new directional sprite loading');
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await money(),'2993800','Budget survives reload');
  for(const width of [360,412,1200]){
   await page.setViewportSize({width,height:850});
   for(const tab of ['map','calls','services','finance','garage']){
    await page.locator('[data-tab="'+tab+'"]').click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,
     'No horizontal overflow: '+tab+' at '+width);
   }
   if(width===360){
    assert.equal(await page.locator("header .weather").evaluate(el=>getComputedStyle(el).display!=="none"),true,"Mobile weather visible");
    await page.locator('[data-tab="map"]').click();
    await page.screenshot({path:'artifacts/upravdom-map-360.png'});
   }
  }
  await page.setViewportSize({width:412,height:915});
  for(const width of [360,412]){
   await page.setViewportSize({width,height:915});
   const metrics=await page.locator('#header').evaluate(header=>{
    const rect=s=>header.querySelector(s).getBoundingClientRect();
    const a=rect('.brand'),b=rect('.stats'),n=rect('.notifications');
    const c=rect('.clock-stat'),w=rect('.weather'),cash=rect('.budget');
    return {brandClear:a.bottom<=b.top+3,alertsClear:a.right<n.left+3,
      metricsClear:c.right<=w.left+3&&w.right<=cash.left+3,
      budgetVisible:cash.right<=innerWidth+1};
   });
   assert.ok(Object.values(metrics).every(Boolean),'Header must not overlap at '+width+': '+JSON.stringify(metrics));
  }
  await page.setViewportSize({width:412,height:915});
  await page.locator('[data-tab="services"]').click();
  await page.locator('.crew-vehicle img').first().waitFor({state:'visible'});
  assert.equal(await page.locator('.crew-vehicle img').count(),3,'Three specialized crew vehicles');
  assert.equal(await page.locator('.crew-vehicle img').evaluateAll(xs=>xs.every(x=>x.complete&&x.naturalWidth>0)),true,'All crew sprites loaded');
  await page.screenshot({path:'artifacts/upravdom-crews-412.png',fullPage:false});
  await page.locator('[data-tab="garage"]').click();
  assert.equal(await page.locator('.garage-vehicle img').count(),3,'Garage uses same 3D vehicle art');
  assert.equal(await page.locator('.garage-vehicle img').evaluateAll(xs=>new Set(xs.map(x=>x.getAttribute('src'))).size),3,'Each crew must have a distinct vehicle');
  assert.equal(await page.locator('.garage-vehicle img').evaluateAll(xs=>xs.every(x=>x.complete&&x.naturalWidth>0)),true,'All garage sprites loaded');
  await page.screenshot({path:'artifacts/upravdom-garage-412.png',fullPage:false});
  assert.equal(await page.getByRole('heading',{name:'Гараж и техника'}).count(),1);
  assert.equal(await page.locator('#page .garage-card').count(),3);
  await page.locator('[data-tab="map"]').click();
  await page.locator('button[data-action="district"]').click();
  assert.equal(await page.getByRole('dialog').isVisible(),true);
  await page.getByRole('button',{name:'Закрыть',exact:true}).click();
  assert.deepEqual(errors,[],'No uncaught browser script errors');
  console.log('UI smoke passed: gameplay, persistence, five tabs, three viewports, garage, district');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
