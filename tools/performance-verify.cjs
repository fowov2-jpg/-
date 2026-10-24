const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const {createServer}=await import('./serve.js'),server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:412,height:915}});
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('[data-cmd=new]').click();await page.locator('[data-cmd=regionProceed]').click();await page.locator('[data-cmd=start]').click();await page.locator('#campaignMap[data-renderer=ready]').waitFor();await page.locator('[data-cmd=pause]').click();
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  const report=await page.evaluate(async()=>{
   const E=await import('./campaign-engine.js'),M=await import('./campaign-map.js'),s=E.freshCompany(112),canvas=document.querySelector('#campaignMap');E.start(s);
   for(const c of s.calls){const crew=s.crews.find(cr=>!E.reason(s,c,cr));if(crew)E.dispatch(s,c.mission,crew.id);}
   const view={x:2100,y:1400,scale:.3},timings=[];
   for(let i=0;i<100;i++){const t=performance.now();M.render(canvas,s,view,{progress:i/100});if(i>9)timings.push(performance.now()-t);}
   timings.sort((a,b)=>a-b);const original=canvas.dataset.camera;view.x+=100;M.render(canvas,s,view);if(canvas.dataset.camera===original)throw Error('Cached camera did not update');
   return {viewport:[innerWidth,innerHeight],cpuThrottle:4,frames:timings.length,medianMs:timings[Math.floor(timings.length/2)],p95Ms:timings[Math.floor(timings.length*.95)],maxMs:timings.at(-1),cameraInvalidation:true};
  });
  assert.ok(report.p95Ms<50,'Map render exceeds 50ms at 4x CPU throttling: '+report.p95Ms);
  await fs.mkdir('test-results/performance',{recursive:true});await fs.writeFile('test-results/performance/report.json',JSON.stringify(report,null,2));console.log('MAP PERFORMANCE '+JSON.stringify(report));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
