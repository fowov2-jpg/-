"""Pack transparent Blender exports, retaining their camera origin after cropping.
Run after all three build scripts. Pillow only packs exports; modelling and rendering
are done in Blender. --partial is for local integration previews only.
"""
from pathlib import Path
from PIL import Image
import argparse, json, math
parser=argparse.ArgumentParser();parser.add_argument('--input',default=str(Path(__file__).resolve().parent/'build'));parser.add_argument('--partial',action='store_true')
args=parser.parse_args();ROOT=Path(__file__).resolve().parents[2];SOURCE=Path(args.input);OUT=ROOT/'web/assets/blender';OUT.mkdir(parents=True,exist_ok=True)
specs=json.loads((SOURCE/'fleet-metadata.json').read_text());props=json.loads((SOURCE/'props-metadata.json').read_text()) if (SOURCE/'props-metadata.json').exists() else {}
missing=[];sheets={};models={};prop_models={}

def crop(path):
    if not path.exists():
        missing.append(path.name);return None
    im=Image.open(path).convert('RGBA')
    # Cycles' transparent shadow catcher leaves almost invisible Monte Carlo
    # noise far outside the model. Remove that floor before measuring the crop;
    # otherwise a tiny truck costs an entire square texture in Android memory.
    alpha=im.getchannel('A').point(lambda a:max(0,round((a-14)*255/241)))
    alpha=alpha.point(lambda a:0 if a<4 else a);im.putalpha(alpha)
    bounds=alpha.getbbox()
    if not bounds:raise ValueError('Empty render: '+path.name)
    x0,y0,x1,y1=bounds;x0=max(0,x0-2);y0=max(0,y0-2);x1=min(im.width,x1+2);y1=min(im.height,y1+2)
    return im.crop((x0,y0,x1,y1)),[im.width/2-x0,im.height/2-y0]

def pack(category,entries):
    # Shelf packing with a two-pixel transparent gutter. Pages fit 2048px textures.
    packed=[];placements={};x=y=row=0;page=0;images=[];height=0
    def flush():
        nonlocal images,height,page
        if not images:return
        h=math.ceil(height/4)*4;atlas=Image.new('RGBA',(2048,h))
        for im,px,py in images:atlas.paste(im,(px,py))
        filename=category+'-'+str(page)+'.webp';atlas.save(OUT/filename,'WEBP',lossless=True,method=6)
        packed.append({'src':'./assets/blender/'+filename,'width':2048,'height':h})
        images=[];height=0;page+=1
    renders=[]
    for key,path in entries:
        item=crop(path)
        if item:renders.append((key,*item))
    for key,im,origin in sorted(renders,key=lambda item:-item[1].height):
        if x+im.width+2>2048:x=0;y+=row+2;row=0
        if y+im.height+2>2048:flush();x=y=row=0
        placements[key]=[page,x,y,im.width,im.height,*origin]
        images.append((im,x,y));height=max(height,y+im.height+2);x+=im.width+2;row=max(row,im.height)
    flush();sheets[category]=packed;return placements

bodies=pack('body',[(s['id']+':'+str(a),SOURCE/'raw'/(s['id']+'-body-'+str(a)+'.png')) for s in specs for a in range(16)])
rigs=pack('rig',[(s['id']+':'+str(d)+':'+str(a),SOURCE/'raw'/(s['id']+'-rig-'+str(d)+'-'+str(a)+'.png')) for s in specs if s.get('mechanism') for d in range(5) for a in range(8)])
prop_frames=pack('props',[(name,SOURCE/'raw'/('prop-'+name+'.png')) for name in props])
for s in specs:
    model={'metres':s['length'],'width':s['width'],'worldLength':s['legacy'],'bodyView':s['bodyView'],'bodyCell':s['bodyCell'],'rigView':s['rigView'],'pivot':s['pivot'],'mechanism':s.get('mechanism'),
           'body':[bodies.get(s['id']+':'+str(a)) for a in range(16)]}
    if s.get('mechanism'):model['rig']=[[rigs.get(s['id']+':'+str(d)+':'+str(a)) for a in range(8)] for d in range(5)]
    item=crop(SOURCE/'raw'/(s['id']+'-garage.png'))
    if item:
        im,_=item;im.save(OUT/('garage-'+s['id']+'.webp'),'WEBP',quality=94,method=6)
        model['card']={'src':'./assets/blender/garage-'+s['id']+'.webp','width':im.width,'height':im.height}
    body=crop(SOURCE/'raw'/(s['id']+'-body-0.png'))
    upper=crop(SOURCE/'raw'/(s['id']+'-rig-0-0.png')) if s.get('mechanism') else None
    if body and (not s.get('mechanism') or upper):
        # Compact unit icons include the stowed equipment as well as the chassis.
        # Composite the same two Blender camera layers used by the runtime.
        icon=Image.new('RGBA',(640,640));image,origin=body
        icon.alpha_composite(image,(round(320-origin[0]),round(320-origin[1])))
        if upper:
            image,origin=upper;scale=s['bodyCell']*s['rigView']/(256*s['bodyView'])
            image=image.resize((round(image.width*scale),round(image.height*scale)),Image.Resampling.LANCZOS)
            icon.alpha_composite(image,(round(320-origin[0]*scale),round(320-origin[1]*scale-s['pivot']*s['bodyCell']/s['bodyView'])))
        bounds=icon.getchannel('A').point(lambda a:255 if a>3 else 0).getbbox();icon=icon.crop(bounds)
        icon.save(OUT/('icon-'+s['id']+'.webp'),'WEBP',lossless=True,method=6)
        model['icon']={'src':'./assets/blender/icon-'+s['id']+'.webp','width':icon.width,'height':icon.height}
    models[s['id']]=model
for name,meta in props.items():prop_models[name]={**meta,'frame':prop_frames.get(name)}
neighborhoods=[]
for i in range(10):
    path=SOURCE/'raw'/('courtyard-'+str(i)+'.png')
    if not path.exists():missing.append(path.name);neighborhoods.append(None);continue
    im=Image.open(path).convert('RGB');im.save(OUT/('courtyard-'+str(i)+'.webp'),'WEBP',quality=92,method=6)
    neighborhoods.append('./assets/blender/courtyard-'+str(i)+'.webp')
if not args.partial and (missing or len(specs)!=17 or len(props)!=19):
    raise SystemExit('Incomplete Blender export: '+str(missing)+', models='+str(len(specs))+', props='+str(len(props)))
manifest='// Generated by art/blender/pack_assets.py. Frame: page,x,y,w,h,originX,originY.\n'
for name,value in [('ART_SHEETS',sheets),('BLENDER_MODELS',models),('BLENDER_PROPS',prop_models),('NEIGHBORHOODS',neighborhoods)]:
    manifest+='export const '+name+'='+json.dumps(value,separators=(',',':'))+';\n'
(ROOT/'web/blender-manifest.js').write_text(manifest)
report={'models':len(models),'bodyFrames':len(bodies),'rigFrames':len(rigs),'props':len(prop_models),'neighborhoods':len([n for n in neighborhoods if n]),'partial':bool(missing),'sheets':sheets,
        'compressedBytes':sum(f.stat().st_size for f in OUT.glob('*.webp')),'decodedAtlasBytes':sum(s['width']*s['height']*4 for pages in sheets.values() for s in pages)}
(SOURCE/'asset-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
