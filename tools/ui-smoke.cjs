// Optional manual UI gate. Requires: npm install --no-save playwright; npx playwright install chromium.
// Start npm start first, then run node tools/ui-smoke.cjs.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({headless:true});
 try {
  const page = await browser.newPage({viewport:{width:412,height:915}});
  const errors=[];page.on('pageerror', e=>errors.push(e.message));
  await page.goto('http://localhost:4173');
  await page.getByRole('button',{name:'Начать смену',exact:true}).click();
  await page.getByRole('button',{name:'Пауза',exact:true}).click();
  await page.locator('button[data-action="call"]').first().click();
  await page.getByRole('button',{name:'Уточнить обстоятельства'}).click();
  await page.locator('button[data-action="dispatch"]:not([disabled])').click();
  await page.getByRole('button',{name:'Закрыть',exact:true}).click();
  const budget = (await page.locator('header .money').innerText()).replace(/\s/g,'');
  assert.equal(budget,'2993800₽');
  await page.reload();assert.equal((await page.locator('header .money').innerText()).replace(/\s/g,''),budget);
  for(const width of [360,412,1200]) {
   await page.setViewportSize({width,height:800});
   for(const tab of ['map','calls','services','finance']) {
    await page.locator(`[data-tab="${tab}"]`).click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   }
  }
  assert.deepEqual(errors,[]);console.log('UI smoke passed');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
