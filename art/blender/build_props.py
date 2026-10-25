"""Original municipal worksite models. No purchased or third party meshes."""
import bpy, sys, math, argparse, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from common import *
parser=argparse.ArgumentParser();parser.add_argument('--output',default=str(Path(__file__).resolve().parent/'build'))
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
OUT=Path(args.output);(OUT/'raw').mkdir(parents=True,exist_ok=True);(OUT/'source').mkdir(exist_ok=True)
reset();scene=studio(40,True)
M={
 'navy':material('Heavy work trousers',(.018,.045,.09),0,.87,.1),
 'boot':material('Steel toe rubber boots',(.025,.03,.027),0,.9),
 'skin':material('Workers hands',(.57,.31,.18),0,.6),
 'yellow':material('Hard hat yellow',(.9,.55,.025),.12,.35),
 'reflect':material('Reflective tape',(.78,.84,.7),.25,.3),
 'orange':material('Safety orange',(.85,.19,.015),.05,.55),
 'white':material('White safety stripe',(.78,.8,.71),.1,.6),
 'black':material('Barrier rubber feet',(.035,.045,.042),0,.88),
 'steel':material('Galvanised steel',(.4,.46,.46),.8,.3),
 'red':material('Generator red enamel',(.53,.035,.018),.4,.4),
 'blue':material('Pump blue enamel',(.025,.19,.29),.5,.4),
}
VEST=[material('Service vest '+str(i),c,0,.83,.08) for i,c in enumerate([(.08,.32,.55),(.85,.45,.02),(.17,.37,.21)])]
items=[]
def add(name,view):
    root=empty(name);items.append((name,root,view));return root

for service in range(3):
    for step in range(4):
        root=add('worker-'+str(service)+'-'+str(step),2.4)
        phase=step*math.tau/4
        # Two legs and forearms have distinct walk poses. Helmets remain recognisable from above.
        for side in [-1,1]:
            x=side*.12;y=math.sin(phase)*side*.12
            rod('Trouser leg',(x,0,.88),(x,y,.23),.105,M['navy'],root)
            box('Protective boot',(x,y+.065,.12),(.21,.35,.19),M['boot'],root,.07)
            hand=(side*.32,-y+.1,.91)
            rod('Jacket sleeve',(side*.2,0,1.37),hand,.09,VEST[service],root)
            sphere('Gloved hand',hand,(.075,.085,.085),M['skin'],root)
        box('Work jacket',(0,0,1.15),(.46,.29,.55),VEST[service],root,.12)
        for y in [-.151,.151]:
            box('Reflective waist tape',(0,y,1.04),(.46,.016,.045),M['reflect'],root,.002)
            for x in [-.13,.13]:box('Reflective shoulder tape',(x,y,1.28),(.045,.016,.23),M['reflect'],root,.002)
        sphere('Head',(0,.015,1.53),(.13,.13,.17),M['skin'],root)
        sphere('Safety helmet',(0,0,1.67),(.175,.19,.115),M['yellow'],root)
        box('Helmet brim',(0,.025,1.63),(.38,.42,.025),M['yellow'],root,.055)
        box('Helmet centre rib',(0,-.015,1.765),(.035,.26,.015),M['yellow'],root,.008)

root=add('cone',1.3)
box('Rubber cone foot',(0,0,.045),(.48,.48,.09),M['black'],root,.04)
# Four tapered frustums create a real white band rather than a flat overlay.
for z0,z1,r0,r1,mat in [(0,.23,.18,.12,M['orange']),(.23,.35,.12,.087,M['white']),(.35,.58,.087,.023,M['orange'])]:
    vertices=[(r*math.cos(i*math.tau/24),r*math.sin(i*math.tau/24),z+.08) for z,r in [(z0,r0),(z1,r1)] for i in range(24)]
    mesh('Cone reflective section',vertices,[tuple(range(23,-1,-1)),tuple(range(24,48))]+[(i,(i+1)%24,(i+1)%24+24,i+24) for i in range(24)],mat,root)

root=add('barrier',2.8)
for x in [-.72,.72]:
    box('Weighted barrier foot',(x,0,.08),(.32,.65,.16),M['black'],root,.04)
    cylinder('Barrier upright',(x,0,.57),.035,.95,M['steel'],root)
box('High visibility panel',(0,0,.85),(1.85,.11,.27),M['white'],root,.025)
for x in [-.72,-.36,0,.36,.72]:
    panel=box('Diagonal safety stripe',(x,-.062,.85),(.17,.012,.26),M['orange'],root,.001);panel.rotation_euler[1]=-.5

root=add('pump',2.0)
box('Pump skid',(0,0,.11),(.85,.7,.14),M['black'],root,.045)
cylinder('Pump volute',(-.13,.05,.38),.24,.31,M['blue'],root,'X')
cylinder('Electric motor',(.23,.05,.4),.18,.38,M['steel'],root,'X')
cylinder('Hose coupling',(-.13,.31,.35),.09,.23,M['steel'],root,'Y')
for x in [-.4,.4]:
    for y in [-.32,.32]:rod('Pump protective frame',(x,y,.1),(x,y,.7),.025,M['steel'],root)
    rod('Pump carry handle',(x,-.32,.7),(x,.32,.7),.025,M['steel'],root)

root=add('generator',2.0)
box('Generator engine',(0,0,.35),(.63,.48,.5),M['black'],root,.04)
box('Fuel tank',(0,0,.65),(.72,.5,.16),M['red'],root,.055)
cylinder('Filler cap',(0,0,.75),.055,.025,M['black'],root)
for x in [-.44,.44]:
    for y in [-.32,.32]:rod('Tubular frame',(x,y,.1),(x,y,.78),.026,M['steel'],root)
    rod('Tubular carry handle',(x,-.32,.78),(x,.32,.78),.026,M['steel'],root)

root=add('toolbox',1.3)
box('Tool chest',(0,0,.2),(.64,.35,.34),M['blue'],root,.045)
box('Tool chest lid',(0,0,.385),(.66,.37,.045),M['steel'],root,.01)
box('Carry handle',(0,0,.45),(.2,.08,.06),M['black'],root,.015)
for x in [-.22,.22]:box('Brass latch',(x,-.19,.35),(.055,.025,.09),M['yellow'],root,.008)

root=add('stabilizer',3.2)
box('Stabiliser sleeve',(0,0,.65),(2.6,.23,.2),M['steel'],root,.025)
for x in [-1.13,1.13]:
    cylinder('Hydraulic stabilizer jack',(x,0,.38),.105,.63,M['steel'],root)
    box('Stabilizer foot',(x,0,.06),(.42,.4,.1),M['black'],root,.025)

root=add('cable-reel',1.8)
for y in [-.23,.23]:cylinder('Cable drum flange',(0,y,.34),.31,.055,M['yellow'],root,'Y')
cylinder('Cable reel core',(0,0,.34),.23,.4,M['black'],root,'Y')
for x in [-.36,.36]:rod('Reel stand',(x,-.3,.05),(x,.3,.05),.035,M['steel'],root)

ground=box('Shadow catcher',(0,0,-.04),(20,20,.06),M['white'],bevel=0);ground.is_shadow_catcher=True
cam=camera('Worksite orthographic camera',(0,0,20),(0,0,0),3)
for _,root,_ in items:show(root,False)
metadata={}
for name,root,view in items:
    show(root,True);cam.data.ortho_scale=view
    render(OUT/'raw'/('prop-'+name+'.png'),128,128,40)
    show(root,False);metadata[name]={'view':view,'cell':128}
for i,(_,root,_) in enumerate(items):
    root.location=((i%5-2)*4,(i//5-2)*4,0);show(root,True)
ground.hide_render=True
cam.location=(13,-18,22);cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=29
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'source'/'worksite-props.blend'),compress=True)
(OUT/'props-metadata.json').write_text(json.dumps(metadata,indent=2))
print('UPRAVDOM_PROPS_RENDER_COMPLETE',len(items),flush=True)
