// Screenshot and layout acceptance for the campaign, using real game state and controls.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const {createServer}=await import('./serve.js'),server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 const report={screens:[],errors:[],httpErrors:[]};
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
  await fs.mkdir('test-results/design',{recursive:true});
  for(const width of [344,412,960]){
   const page=await browser.newPage({viewport:{width,height:width===344?689:900}});
   page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.httpErrors.push(r.status()+' '+r.url());});
   await page.goto(`http://127.0.0.1:${server.address().port}`);
   const click=cmd=>page.locator(`[data-cmd="${cmd}"]`).click();
   const capture=async name=>{
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' overflows viewport');
    const clipped=await page.locator('.workerTile strong,.crewHeadingName strong,.campaignHeader strong').evaluateAll(nodes=>nodes.filter(n=>n.scrollWidth>n.clientWidth+2).map(n=>n.textContent));
    assert.deepEqual(clipped,[],name+' clips text');
    await page.screenshot({path:`test-results/design/${width}-${name}.png`});report.screens.push({width,name});
   };
   await page.locator('.campaignMenu').waitFor();await page.evaluate(()=>document.fonts.ready);await capture('menu');
   await click('new');await capture('districts');await click('regionProceed');await capture('crews');
   for(const sub of ['fleet','people','stock']){await page.locator(`[data-cmd=sub][data-sub=${sub}]`).click();await capture(sub);}
   await page.locator('[data-cmd=sub][data-sub=fleet]').click();await click('catalog');await capture('catalog');
   await click('start');await page.locator('#campaignMap[data-renderer=ready]').waitFor();await click('pause');await capture('map');
   await click('calls');await capture('calls');await page.locator('[data-cmd=select]').first().click();await capture('incident');
   await click('assign');await capture('assign');await page.locator('dialog [data-cmd=dispatch]:not(:disabled)').first().click();
   await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await capture('dispatch');
   await click('menu');await click('settings');await capture('settings');await page.close();
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);
  await fs.writeFile('test-results/design/report.json',JSON.stringify(report,null,2));console.log('DESIGN VERIFIED '+report.screens.length+' screens; no clipped roster text, horizontal overflow, JS or HTTP errors');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
