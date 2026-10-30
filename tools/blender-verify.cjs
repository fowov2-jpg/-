// Real Canvas renderer and game controls, using locally bundled Blender exports.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const {createServer}=await import('./serve.js'),E=await import('../web/campaign-engine.js'),server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;const report={models:[],screens:[],checks:[],errors:[],httpErrors:[]},preview=process.argv.includes('--preview');
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1200,height:1000}}),origin=`http://127.0.0.1:${server.address().port}`;
  page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.httpErrors.push(r.status()+' '+r.url());});
  await fs.mkdir('test-results/blender',{recursive:true});await page.goto(origin);await page.locator('.campaignMenu').waitFor();
  await page.evaluate(async()=>{const A=await import('./blender-art.js');A.loadBlenderArt();window.blenderArt=A;});
  await page.waitForFunction(()=>window.blenderArt.blenderArtReady());
  const pixels=await page.evaluate(async preview=>{
   const {BLENDER_MODELS,ART_SHEETS}=await import('./blender-manifest.js'),{VEHICLE_MODELS}=await import('./content.js'),{vehicle}=await import('./graphics.js');
   const models=VEHICLE_MODELS.filter(m=>BLENDER_MODELS[m.id].body.every(Boolean)&&(!BLENDER_MODELS[m.id].rig||BLENDER_MODELS[m.id].rig.flat().every(Boolean)));
   if(!preview&&models.length!==17)throw Error('Incomplete vehicle exports');
   document.body.innerHTML='<main id="artReview" style="padding:22px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px;background:#1b2733"></main>';
   const result=[];
   for(const model of models){
    const card=document.createElement('article');card.style.cssText='background:#263440;border:1px solid #435360;border-radius:12px;padding:12px;text-align:center;color:#e2e6dc';
    card.innerHTML=`<p style="font-size:12px;margin-bottom:12px">${model.name}</p><div style="height:155px;display:flex;justify-content:center">${vehicle(1,model.id)}</div>`;
    card.querySelector('.vehiclePhoto').style.height='150px';
    const canvas=document.createElement('canvas');canvas.width=336;canvas.height=225;canvas.style.cssText='width:100%;height:auto;margin-top:12px';card.append(canvas);document.querySelector('#artReview').append(card);
    const ctx=canvas.getContext('2d');ctx.translate(168,112);
    const test=document.createElement('canvas');test.width=test.height=320;const tc=test.getContext('2d');tc.translate(160,160);
    let min=Infinity,changed=0,baseline=null;
    for(let d=0;d<9;d++)for(let a=0;a<16;a++){
     tc.clearRect(-160,-160,320,320);
     const state={phase:d===8?'working':d?'deploying':'stowed',deployment:d/8,cycle:.25};
     if(!window.blenderArt.drawBlenderVehicle(tc,model.id,state,80,a*Math.PI/8,-Math.PI/4))throw Error(model.id+' did not draw');
     const rgba=tc.getImageData(0,0,320,320).data;let opaque=0;
     for(let i=3;i<rgba.length;i+=4)if(rgba[i]>80)opaque++;
     min=Math.min(min,opaque);
     if(a===0&&d===0)baseline=rgba;
     if(a===0&&d===8)for(let i=0;i<rgba.length;i++)if(rgba[i]!==baseline[i])changed++;
    }
    const state={phase:'working',deployment:1,cycle:.25};window.blenderArt.drawBlenderVehicle(ctx,model.id,state,99,0,-Math.PI/4);
    ctx.rotate(Math.PI/2);window.blenderArt.drawBlenderWorksite(ctx,model.id,99,99*BLENDER_MODELS[model.id].width/BLENDER_MODELS[model.id].metres,{status:'repair',total:40,remaining:25},1,100,0,false,-Math.PI*.75);
    result.push({id:model.id,minOpaque:min,deploymentChanged:changed,rig:!!BLENDER_MODELS[model.id].rig});
   }
   // Wait for the same garage images used in normal crew cards.
   await Promise.all(models.map(m=>new Promise((resolve,reject)=>{const im=new Image();im.onload=resolve;im.onerror=reject;im.src=BLENDER_MODELS[m.id].card.src;})));
   // Independently check fixed mechanisms in the exported pixels: a 90-degree
   // chassis turn must rotate their shape and camera anchor by the same amount.
   const rigImages=await Promise.all(ART_SHEETS.rig.map(p=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=p.src;})));
   function moments(f){
    const c=document.createElement('canvas');c.width=c.height=300;const cx=c.getContext('2d'),[p,x,y,w,h,ox,oy]=f;cx.drawImage(rigImages[p],x,y,w,h,150-ox,150-oy,w,h);
    const rgba=cx.getImageData(0,0,300,300).data;let n=0,sx=0,sy=0,xx=0,yy=0;
    for(let y=0;y<300;y++)for(let x=0;x<300;x++){const i=(y*300+x)*4;if(rgba[i+3]<230||rgba[i]+rgba[i+1]+rgba[i+2]<150)continue;const px=x-150,py=y-150;n++;sx+=px;sy+=py;xx+=px*px;yy+=py*py;}
    if(n<80)throw Error('Empty fixed mechanism');return {x:sx/n,y:sy/n,xx:xx/n-(sx/n)**2,yy:yy/n-(sy/n)**2};
   }
   for(const model of models){const art=BLENDER_MODELS[model.id];if(!['tipper','scissor'].includes(art.mechanism))continue;
    const north=moments(art.rig[0][0]),east=moments(art.rig[0][2]);
    if(north.yy<north.xx*1.15||east.xx<east.yy*1.15)throw Error(model.id+' fixed mechanism did not follow chassis heading');
    if(Math.hypot(east.x+north.y,east.y-north.x)>7)throw Error(model.id+' mechanism camera anchor moved during rotation');
   }
   return result;
  },preview);
  assert.ok(pixels.length>0,'No complete vehicle exports to verify');
  for(const model of pixels){assert.ok(model.minOpaque>350,model.id+' empty or tiny crop');if(model.rig)assert.ok(model.deploymentChanged>150,model.id+' missing deployment');report.models.push(model.id);}
  await page.screenshot({path:'test-results/blender/fleet-and-worksites.png',fullPage:true});report.screens.push('fleet-and-worksites');
  report.checks.push(`${pixels.length} models × 16 headings × 9 deployment positions, including interpolation, draw complete sprites; deployment changes checked for each mechanism`);
  if(!preview||process.argv.includes('--flow'))for(const width of [344,412,960]){
   await page.setViewportSize({width,height:width===344?740:960});await page.goto(origin);await page.locator('.campaignMenu').waitFor();
   const click=cmd=>page.locator(`[data-cmd="${cmd}"]`).filter({visible:true}).first().click();
   const capture=async name=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' overflow');await page.screenshot({path:`test-results/blender/${width}-${name}.png`});report.screens.push(width+'-'+name);};
   await page.evaluate(raw=>window.dispatchEvent(new CustomEvent('upravdom-import',{detail:raw})),E.encode(E.freshCompany(112)));
   await page.locator('.dispatchCrew').first().waitFor();await capture('crews');
   const s=E.freshCompany(112);E.start(s);s.calls=[];s.cursor=0;s.done=[];s.operations.planIndex=0;s.operations.shift.schedule=[];s.operations.shift.admitted=0;
   E.Operations.issue(s,'flood',s.operations.houses[1].id);E.answer(s,0,'risk');E.answer(s,0,'local');for(const cr of s.crews)E.dispatch(s,0,cr.id);E.tick(s,40);E.decode(E.encode(s));
   await page.evaluate(raw=>window.dispatchEvent(new CustomEvent('upravdom-import',{detail:raw})),E.encode(s));
   await page.locator('#campaignMap[data-renderer=ready][data-graphics=blender]').waitFor();
   await click('prep');await page.locator('[data-cmd=op-locateCrew]').first().click();
   assert.equal(await page.locator('.opRackVehicle [data-view=overhead]').count(),3);
   const canvas=page.locator('#campaignMap'),box=await canvas.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height*.55);await page.mouse.wheel(0,-650);await page.waitForTimeout(180);
   if(await page.locator('[data-cmd=deselect]').isVisible())await click('deselect');
   await capture('joint-worksite');
   const frozen=await canvas.evaluate(n=>n.toDataURL());await page.waitForTimeout(350);assert.equal(await canvas.evaluate(n=>n.toDataURL()),frozen,'Paused art moved');
   await click('plan');await page.locator('[data-cmd=territory-tab][data-tab=houses]').click();await page.locator('[data-cmd=op-house]').first().click();
   await page.locator('.opHouseArtwork img').evaluate(im=>im.decode());await capture('house');await click('close');
   await page.reload();await click('continue');await page.locator('#campaignMap[data-graphics=blender]').waitFor();
   assert.equal(await page.locator('#campaignMap').getAttribute('data-operations'),'original-art');
  }
  report.checks.push('Original city, garage, joint worksite, house cards, pause and reload at 344/412/960');
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);
  await fs.writeFile('test-results/blender/report.json',JSON.stringify(report,null,2));console.log('BLENDER VERIFIED '+report.models.length+' models; '+report.screens.length+' screens');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
