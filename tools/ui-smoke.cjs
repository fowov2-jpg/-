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
  await page.screenshot({path:'artifacts/upravdom-map-412.png'});
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
  await page.locator('[data-tab="garage"]').click();
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
