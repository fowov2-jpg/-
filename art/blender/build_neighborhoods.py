"""Editable Russian residential courtyards, rendered for house/district cards.
The existing in-game city plate and road/address geometry are preserved.
"""
import bpy,sys,math,random,argparse,json,subprocess
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).parent))
from common import *
parser=argparse.ArgumentParser();parser.add_argument('--output',default=str(Path(__file__).resolve().parent/'build'));parser.add_argument('--only',type=int);parser.add_argument('--preview',action='store_true');parser.add_argument('--resume',action='store_true');parser.add_argument('--no-render',action='store_true');args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
OUT=Path(args.output);(OUT/'raw').mkdir(parents=True,exist_ok=True);(OUT/'source').mkdir(exist_ok=True);(OUT/'renders').mkdir(exist_ok=True)
if args.only is None and not args.no_render:
    # Cycles/OIDN retain sizeable caches. Bound peak RAM by rendering one scene
    # per process, then assemble the complete editable library without rendering.
    for kind in range(10):
        if args.resume and (OUT/'raw'/('courtyard-'+str(kind)+'.png')).exists():continue
        command=[bpy.app.binary_path,'-b','-t',str(bpy.context.scene.render.threads),'--python',str(Path(__file__).resolve()),'--','--output',str(OUT.resolve()),'--only',str(kind)]
        if args.preview:command.append('--preview')
        subprocess.run(command,check=True)
    args.no_render=True
reset();scene=studio(40,False);scene.render.use_persistent_data=False
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.72,.8,.88,1)
M={
 'plaster':material('Warm mineral plaster',(.56,.5,.39),0,.87,.18),
 'panel':material('Weathered pale concrete panels',(.53,.55,.52),0,.88,.23),
 'brick':material('Old terracotta brick',(.32,.135,.073),0,.88,.2),
 'roof':material('Bitumen roof membrane',(.095,.11,.115),0,.95,.3),
 'coping':material('Roof coping and sills',(.45,.46,.42),0,.82,.12),
 'white':material('Window frame enamel',(.78,.8,.75),.18,.5),
 'frame':material('Anodised aluminium frames',(.28,.34,.35),.65,.37),
 'steel':material('Playground brushed stainless steel',(.46,.51,.53),.8,.26),
 'dark':material('Window recess and metal railings',(.035,.052,.055),.4,.5),
 'glass':material('Blue grey window glass',(.07,.14,.18),.55,.17),
 'cream':material('Curtains behind a window',(.45,.4,.28),.12,.5),
 'door':material('Blue entrance canopy enamel',(.055,.2,.31),.42,.4),
 'grass':material('Autumn grass',(.17,.23,.075),0,1,.3),
 'earth':material('Garden soil',(.15,.105,.055),0,1,.3),
 'paving':material('Concrete paving stones',(.4,.39,.32),0,.87,.16),
 'asphalt':material('Fine-grained asphalt',(.105,.12,.125),0,.94,.24),
 'curb':material('Concrete curb',(.53,.52,.44),0,.9,.16),
 'trunk':material('Birch bark',(.68,.67,.58),0,.92,.3),
 'wood':material('Oiled timber benches',(.25,.135,.055),0,.82,.18),
 'rubber':material('Playground rubber',(.27,.12,.065),0,.9,.1),
 'red':material('Playground red',(.54,.065,.025),.08,.55),
 'blue':material('Playground blue',(.025,.23,.38),.08,.5),
 'yellow':material('Playground yellow',(.77,.46,.035),.08,.6),
 'court':material('Sports court green',(.12,.27,.18),0,.86,.07),
 'mark':material('Faded court markings',(.77,.77,.62),0,.95),
}
LEAVES=[material('Autumn leaf tone '+str(i),c,0,.92) for i,c in enumerate([(.24,.31,.035),(.46,.39,.025),(.70,.43,.018),(.65,.24,.015),(.39,.16,.018),(.12,.23,.035)])]
for name,colors in [('grass',[(.075,.12,.026),(.22,.28,.065)]),('plaster',[(.42,.39,.31),(.61,.56,.44)]),('panel',[(.43,.46,.43),(.62,.63,.57)]),('roof',[(.065,.076,.08),(.15,.16,.155)])]:
    mat=M[name];nodes=mat.node_tree.nodes;links=mat.node_tree.links;tex=nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=12;tex.inputs['Detail'].default_value=3
    ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(*colors[0],1);ramp.color_ramp.elements[1].color=(*colors[1],1)
    links.new(tex.outputs['Fac'],ramp.inputs[0]);links.new(ramp.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color'])
nodes=M['brick'].node_tree.nodes;links=M['brick'].node_tree.links
coord=nodes.new('ShaderNodeTexCoord');axes=nodes.new('ShaderNodeSeparateXYZ');links.new(coord.outputs['Object'],axes.inputs[0])
geom=nodes.new('ShaderNodeNewGeometry');normal=nodes.new('ShaderNodeVectorTransform');normal.vector_type='NORMAL';normal.convert_from='WORLD';normal.convert_to='OBJECT';links.new(geom.outputs['Normal'],normal.inputs[0])
naxes=nodes.new('ShaderNodeSeparateXYZ');links.new(normal.outputs[0],naxes.inputs[0]);absolute=nodes.new('ShaderNodeMath');absolute.operation='ABSOLUTE';links.new(naxes.outputs['X'],absolute.inputs[0]);choice=nodes.new('ShaderNodeMath');choice.operation='GREATER_THAN';choice.inputs[1].default_value=.5;links.new(absolute.outputs[0],choice.inputs[0])
mix=nodes.new('ShaderNodeMixRGB');links.new(choice.outputs[0],mix.inputs[0]);links.new(axes.outputs['X'],mix.inputs[1]);links.new(axes.outputs['Y'],mix.inputs[2]);vector=nodes.new('ShaderNodeCombineXYZ');links.new(mix.outputs[0],vector.inputs[0]);links.new(axes.outputs['Z'],vector.inputs[1])
brick=nodes.new('ShaderNodeTexBrick');brick.inputs['Scale'].default_value=1;brick.inputs['Brick Width'].default_value=.25;brick.inputs['Row Height'].default_value=.075;brick.inputs['Mortar Size'].default_value=.009;brick.inputs['Color1'].default_value=(.32,.13,.07,1);brick.inputs['Color2'].default_value=(.43,.20,.11,1);brick.inputs['Mortar'].default_value=(.28,.26,.21,1)
links.new(vector.outputs[0],brick.inputs['Vector']);links.new(brick.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color']);bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.28;bump.inputs['Distance'].default_value=.025;bump.invert=True;links.new(brick.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs[0],nodes.get('Principled BSDF').inputs['Normal'])

class Boxes:
    def __init__(self,parent):self.parent=parent;self.groups={}
    def add(self,loc,size,mat,angle=0):
        vertices,faces=self.groups.setdefault(mat.name,([],[]));offset=len(vertices);x,y,z=[v/2 for v in size];a,b=math.cos(angle),math.sin(angle)
        for vx,vy,vz in [(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)]:vertices.append((loc[0]+vx*a-vy*b,loc[1]+vx*b+vy*a,loc[2]+vz))
        faces.extend(tuple(offset+i for i in f) for f in [(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
    def finish(self,name,bevel=.012):
        for key,(vs,fs) in self.groups.items():mesh(name+' · '+key,vs,fs,bpy.data.materials[key],self.parent,bevel)

def building(parent,loc,dimensions,floors,facade,seed,angle=0):
    rng=random.Random(seed);root=empty('Residential building · '+str(floors)+' floors',parent);root.location=loc;root.rotation_euler[2]=angle
    w,d=dimensions;height=floors*2.9+.5
    box('Foundation plinth',(0,0,.48),(w+.12,d+.12,.96),M['coping'],root,.08)
    box('Masonry and panel body',(0,0,height/2+.5),(w,d,height),facade,root,.07)
    box('Bitumen roof',(0,0,height+.56),(w-.32,d-.32,.12),M['roof'],root,.035)
    frames=Boxes(root);details=Boxes(root)
    for z in [3.25+i*2.9 for i in range(floors)]:
        details.add((0,-d/2-.012,z),(w,.025,.035),M['coping']);details.add((0,d/2+.012,z),(w,.025,.035),M['coping'])
    for side in [-1,1]:
        details.add((side*(w/2-.09),0,height+.7),(.18,d,.24),M['coping']);details.add((0,side*(d/2-.09),height+.7),(w,.18,.24),M['coping'])
    for back in [-1,1]:
        cols=max(3,int(w/3.05));step=w/(cols+1)
        for col in range(cols):
            x=-w/2+(col+1)*step
            details.add((x+step/2,back*(d/2+.012),height/2+.5),(.025,.025,height-.15),M['coping'])
            for floor in range(floors):
                z=2.0+floor*2.9;y=back*(d/2+.035);glass=M['cream'] if rng.random()<.18 else M['glass'];ww=1.34;hh=1.55
                frames.add((x,y,z),(ww+.18,.09,hh+.18),M['dark']);frames.add((x,y+back*.06,z),(ww,.04,hh),glass)
                for sx in [-1,1]:frames.add((x+sx*ww/2,y+back*.09,z),(.07,.08,hh+.08),M['white'])
                for sz in [-1,1]:frames.add((x,y+back*.09,z+sz*hh/2),(ww+.08,.1,.065),M['white'])
                frames.add((x+.18,y+back*.1,z),(.045,.1,hh),M['white']);frames.add((x,y+back*.13,z-hh/2-.04),(ww+.3,.32,.08),M['white'])
                if back==1 and col%3==1 or back==-1 and col%4==2 and floor>0:
                    balcony_y=y+back*.6
                    frames.add((x,balcony_y,z-.93),(1.85,1.3,.12),M['coping'])
                    for sx in [-1,1]:frames.add((x+sx*.86,balcony_y+back*.1,z-.45),(.06,1.1,.88),M['white'])
                    frames.add((x,balcony_y+back*.62,z-.48),(1.8,.07,.85),M['white'] if rng.random()<.55 else M['brick'])
                    frames.add((x,balcony_y+back*.64,z+.03),(1.86,.07,.065),M['dark'])
                if rng.random()<.08:
                    frames.add((x+.88,y+back*.23,z-.65),(.62,.42,.4),M['white'])
                    for i in range(5):frames.add((x+.88,y+back*.455,z-.8+i*.06),(.52,.02,.015),M['frame'])
        # Downpipes follow the actual facade rather than floating beside it.
        for x in [-w/2+.26,w/2-.26]:rod('Rainwater downpipe',(x,back*(d/2+.13),.4),(x,back*(d/2+.13),height+.65),.06,M['frame'],root)
    # Gable windows and brick mortar bands add depth in three-quarter views.
    for side in [-1,1]:
        for floor in range(floors):
            for y in [-d*.23,d*.23]:
                z=2+floor*2.9;frames.add((side*(w/2+.04),y,z),(.08,1.1,1.55),M['dark']);frames.add((side*(w/2+.1),y,z),(.05,.95,1.42),M['glass'])
                for yy in [y-.49,y+.49]:frames.add((side*(w/2+.14),yy,z),(.1,.055,1.48),M['white'])
                for zz in [z-.74,z+.74]:frames.add((side*(w/2+.14),y,zz),(.1,1.03,.06),M['white'])
    for x in [-w*.3,0,w*.3]:
        box('Entrance porch',(x,-d/2-1.3,.12),(2.8,2.5,.24),M['paving'],root,.04)
        for i in range(3):box('Entrance steps',(x,-d/2-1.9-i*.25,.08+i*.05),(2.2,.3,.12+i*.1),M['curb'],root,.022)
        box('Entrance door frame',(x,-d/2-.06,1.26),(1.45,.18,2.4),M['dark'],root,.035)
        box('Entrance glazed doors',(x,-d/2-.18,1.25),(1.2,.08,2.12),M['glass'],root,.02)
        for sx in [-1,1]:rod('Entrance handrail',(x+sx*1.08,-d/2-2.2,.65),(x+sx*1.08,-d/2-.5,1.0),.035,M['frame'],root)
        box('Blue entrance canopy',(x,-d/2-.7,2.65),(2.8,1.65,.12),M['door'],root,.055)
        box('Entry light',(x,-d/2-.14,2.47),(.55,.12,.12),M['white'],root,.03)
    vents=max(3,int(w/10))
    for i in range(vents):
        x=(i-(vents-1)/2)*8
        box('Ventilation shaft',(x,.3,height+1.02),(1.1,1.3,.9),M['brick'],root,.05)
        box('Vent rain cap',(x,.3,height+1.55),(1.4,1.6,.13),M['frame'],root,.025)
    for i in range(4):
        box('Roof membrane lap',(0,-d/2+1+i*(d-2)/3,height+.635),(w-.5,.035,.018),M['coping'],root,.005)
    rod('Television aerial mast',(w*.36,1,height+.65),(w*.36,1,height+3.1),.035,M['frame'],root)
    for z in [height+2.2,height+2.55,height+2.9]:rod('Aerial dipole',(w*.36-.65,1,z),(w*.36+.65,1,z),.018,M['frame'],root)
    frames.finish('Window and balcony joinery');details.finish('Facade and roof details')
    return root

_tree_meshes={}
def tree(parent,x,y,seed,scale=1):
    rng=random.Random(seed);variant=seed%5
    root=empty('Birch and autumn canopy',parent);root.location=(x,y,.08);root.scale=(scale,scale,scale)
    cylinder('Birch trunk',(0,0,3.4),.18,6.8,M['trunk'],root,vertices=12)
    for i in range(14):
        a=rng.random()*math.tau;z=2.8+rng.random()*3.2;length=1.2+rng.random()*1.3
        rod('Fine crown branch',(0,0,z),(math.cos(a)*length,math.sin(a)*length,z+1.0),.035,M['wood'],root,8)
    if variant not in _tree_meshes:
        vertices=[];faces=[];tones=[]
        lr=random.Random(variant+313)
        for i in range(2200):
            a=lr.random()*math.tau;z=lr.uniform(3.8,9.6);r=(lr.random()**.5)*2.9*math.sqrt(max(.05,1-((z-6.6)/3.25)**2));r*=.84+.15*math.sin(a*5+z*.75)+.09*math.cos(a*3-z);cx,cy=math.cos(a)*r,math.sin(a)*r
            angle=lr.random()*math.tau;size=lr.uniform(.15,.29);offset=len(vertices)
            dx,dy=math.cos(angle)*size,math.sin(angle)*size
            vertices.extend([(cx-dx,cy-dy,z),(cx-dy*.55,cy+dx*.55,z+.035),(cx+dx,cy+dy,z+.025),(cx+dy*.55,cy-dx*.55,z-.025),(cx,cy,z+.065)])
            faces.extend([(offset,offset+1,offset+4),(offset+1,offset+2,offset+4),(offset+2,offset+3,offset+4),(offset+3,offset,offset+4)]);tones.extend([lr.randrange(len(LEAVES))]*4)
        data=bpy.data.meshes.new('Original sculpted leaf canopy '+str(variant));data.from_pydata(vertices,[],faces);data.update()
        for mat in LEAVES:data.materials.append(mat)
        for polygon,index in zip(data.polygons,tones):polygon.material_index=index;polygon.use_smooth=True
        _tree_meshes[variant]=data
    obj=bpy.data.objects.new('Individual autumn leaves',_tree_meshes[variant]);bpy.context.collection.objects.link(obj);obj.parent=root
    return root

def bench(parent,x,y,angle=0):
    root=empty('Timber park bench',parent);root.location=(x,y,.05);root.rotation_euler[2]=angle
    for sx in [-1,1]:
        for sy in [-1,1]:box('Bench leg',(sx*.72,sy*.22,.27),(.07,.07,.54),M['dark'],root,.015)
    for i in range(4):box('Seat timber slat',(0,(i-1.5)*.14,.57),(1.9,.12,.065),M['wood'],root,.02)
    for i in range(3):box('Backrest timber slat',(0,.29,.83+i*.13),(1.9,.065,.11),M['wood'],root,.02)

def lamp(parent,x,y):
    cylinder('Cast lamp base',(x,y,.16),.24,.32,M['dark'],parent)
    rod('Courtyard lamp post',(x,y,0),(x,y,4.4),.065,M['frame'],parent)
    rod('Lamp curved head',(x,y,4.4),(x+.5,y,4.6),.055,M['frame'],parent)
    box('LED lantern',(x+.6,y,4.57),(.68,.3,.12),M['dark'],parent,.06)
    box('Lantern diffuser',(x+.6,y,4.5),(.54,.23,.025),M['white'],parent,.02)

def playground(parent):
    box('Soft play surface',(6,-4,.05),(15,11,.09),M['rubber'],parent,.2)
    for x in [3.2,5.7]:
        for y in [-4.2,-1.7]:rod('Play tower upright',(x,y,0),(x,y,3.3),.09,M['red'],parent)
    box('Tower deck',(4.45,-2.95,1.8),(2.6,2.6,.15),M['yellow'],parent,.05)
    mesh('Pitched play roof',[(3.0,-4.5,3.2),(5.9,-4.5,3.2),(4.45,-4.5,4.0),(3.0,-1.4,3.2),(5.9,-1.4,3.2),(4.45,-1.4,4.0)],[(0,1,2),(3,5,4),(0,2,5,3),(2,1,4,5)],M['blue'],parent,.025)
    quad('Steel slide bed',[(3.7,-4.25,1.85),(5.2,-4.25,1.85),(5.2,-8,.2),(3.7,-8,.2)],M['steel'],parent)
    for x in [3.7,5.2]:rod('Slide safety side',(x,-4.25,1.99),(x,-8,.34),.08,M['yellow'],parent)
    for step in range(6):box('Play tower stair',(4.45,-.9+step*.25,.2+(5-step)*.3),(1.1,.28,.11),M['blue'],parent,.025)
    for x in [-1,2]:
        for sy in [-1,1]:rod('Swing A-frame',(x,-9+sy*.9,0),(x,-9,2.5),.065,M['blue'],parent)
    rod('Swing crossbar',(-1.2,-9,2.5),(2.2,-9,2.5),.07,M['blue'],parent)
    for x in [-.15,.95]:
        for dx in [-.2,.2]:rod('Swing chain',(x+dx,-9,.56),(x+dx,-9,2.45),.012,M['dark'],parent,6)
        box('Rubber swing seat',(x,-9,.53),(.6,.35,.07),M['dark'],parent,.035)

def court(parent):
    box('Green sports surface',(7,0,.09),(18,25,.1),M['court'],parent,.12)
    for x in [-1.4,15.4]:box('Court boundary',(x,0,.152),(.065,23.5,.006),M['mark'],parent,0)
    for y in [-11.75,0,11.75]:box('Court line',(7,y,.152),(16.8,.065,.006),M['mark'],parent,0)
    for sy in [-1,1]:
        box('Goal backboard',(7,sy*10.9,3.15),(1.8,.08,1.03),M['white'],parent,.03)
        rod('Basketball support',(7,sy*11.6,0),(7,sy*11.6,3.25),.075,M['blue'],parent)
        torus('Basketball hoop',(7,sy*10.45,2.95),.24,.023,M['red'],parent)
    # Circular ground markings are geometry rather than a low resolution decal.
    torus('Centre circle marking',(7,0,.15),2.5,.035,M['mark'],parent)

_car_collections={}
def car(parent,model,loc,angle):
    source=OUT/'source'/'municipal-fleet.blend'
    if not source.exists():return
    if model not in _car_collections:
        with bpy.data.libraries.load(str(source),link=False) as (available,target):target.collections=[model] if model in available.collections else []
        if not target.collections:return
        coll=target.collections[0]
        root=next((obj for obj in coll.objects if obj.parent is None),None)
        if root:root.location=(0,0,0);root.rotation_euler=(0,0,0)
        _car_collections[model]=coll
    obj=empty('Parked '+model,parent);obj.instance_type='COLLECTION';obj.instance_collection=_car_collections[model];obj.location=loc;obj.rotation_euler[2]=angle

def courtyard(kind):
    rng=random.Random(780+kind);root=empty('Courtyard theme '+str(kind));groups=[]
    grass=box('Living landscaped ground',(0,0,-.18),(260,220,.35),M['grass'],root,.15)
    box('Residential street',(0,-34,.01),(210,10,.08),M['asphalt'],root,.08)
    box('Pedestrian pavement',(0,-27.5,.07),(210,3,.15),M['paving'],root,.03)
    box('Street curb',(0,-29.05,.17),(210,.18,.3),M['curb'],root,.025)
    for i in range(46):box('Dashed lane marking',(-102+i*4.5,-34,.056),(2.4,.12,.012),M['mark'],root,0)
    mesh('Continuous courtyard access drive',[(-37.5,-21.5,.09),(37.5,-21.5,.09),(37.5,23.5,.09),(32.5,23.5,.09),(32.5,-16.5,.09),(-32.5,-16.5,.09),(-32.5,23.5,.09),(-37.5,23.5,.09)],[tuple(range(8))],M['asphalt'],root)
    for x in [-37.7,-32.3,32.3,37.7]:box('Drive curb',(x,1,.14),(.18,45,.22),M['curb'],root,.025)
    for y in [-21.7,-16.3]:box('Drive curb',(0,y,.14),(65,.18,.22),M['curb'],root,.025)
    # A paved path leads to every entrance through the actual courtyard.
    for y in [-14,-10,14]:box('Courtyard footpath',(0,y,.06),(65,1.65,.12),M['paving'],root,.04)
    for x in [-24,-8,24]:box('Entrance walkway',(x,3,.061),(1.6,28,.12),M['paving'],root,.04)
    if kind in [4,5]:
        floors=2 if kind==4 else 3
        building(root,(-8,19,0),(55,13),floors,M['brick'],kind)
        building(root,(-29,-1,0),(28,11),1,M['panel'],kind+1,math.pi/2)
        for x in [-13,-3,7,17]:box('Workshop roller shutter',(x,12.41,1.7),(4.6,.1,3.1),M['frame'],root,.04)
        for x in [-5,5,15]:cylinder('Roof extraction fan',(x,19,floors*2.9+1.9),.6,1.1,M['frame'],root)
    elif kind==2:
        building(root,(-23,14,0),(21,17),16,M['panel'],kind)
        building(root,(25,19,0),(19,17),16,M['plaster'],kind+1)
    else:
        floors=9 if kind in [1,7,8,9] else 5
        facade=M['brick'] if kind==7 else M['panel'] if kind==1 else M['plaster']
        building(root,(-5,22,0),(61,11),floors,facade,kind)
        if kind in [0,1,3,6,7]:building(root,(-29,-1,0),(34,10),5 if kind==3 else floors,facade,kind+1,math.pi/2)
    if kind in [0,1,2,7]:court(root)
    else:playground(root)
    # Context continues beyond the camera. The card shows a neighbourhood rather
    # than the cut edge of a model base against an empty studio background.
    if kind not in [4,5,8,9]:
        building(root,(-64,28,0),(46,11),5,M['plaster'],kind+20,math.pi/2)
        building(root,(65,34,0),(43,11),9 if kind in [1,2,7] else 5,M['panel'],kind+21,math.pi/2)
    positions=[(-40,24),(-39,12),(-39,-3),(-39,-15),(-20,-12),(-10,-12),(1,-13),(17,-12),(27,-13),(40,-12),(41,0),(42,14),(38,27),(-22,33),(-8,34),(9,34),(26,33)]
    positions += [(-20,5),(-18,-2),(24,8),(23,0),(30,5),(-43,5),(43,6),(-12,-24),(11,-24)]
    positions += [(x,y) for x,y in [(-48,38),(-38,44),(-20,44),(-3,45),(15,44),(37,45),(48,37),(-48,-14),(49,-10),(-40,-48),(-25,-47),(-9,-48),(12,-47),(29,-46),(47,-45)]]
    if kind==6:positions += [(-17,5),(-15,-3),(23,9),(20,2),(30,5)]
    for i,(x,y) in enumerate(positions):tree(root,x+rng.uniform(-1,1),y+rng.uniform(-1,1),kind*31+i,rng.uniform(.78,1.15))
    for i in range(19):
        shrub=bpy.data.objects.new('Low courtyard shrub',_tree_meshes[i%5]);bpy.context.collection.objects.link(shrub);shrub.parent=root
        shrub.location=(-23+i*2.6,12.5,-.18);shrub.scale=(.31,.31,.13)
    # Individual grass blades add natural texture without replacing the terrain plate.
    grass_vertices=[];grass_faces=[]
    for i in range(12000):
        x,y=rng.uniform(-48,48),rng.uniform(-25,34)
        if abs(y+19)<3.2 or abs(abs(x)-35)<3.3 or abs(y+14)<1.1 or abs(y+10)<1.1 or abs(y-14)<1.1 or any(abs(x-v)<1.0 for v in [-24,-8,24]) or -3<x<18 and -13<y<13 or y>15 or x<-23:continue
        z=rng.uniform(.07,.18);a=rng.random()*math.tau;dx,dy=math.cos(a)*.025,math.sin(a)*.025;o=len(grass_vertices)
        grass_vertices.extend([(x-dx,y-dy,.005),(x+dx,y+dy,.005),(x+dx*.3,y+dy*.3,z)]);grass_faces.append((o,o+1,o+2))
    mesh('Fine unmown grass',grass_vertices,grass_faces,M['grass'],root)
    for x,y in [(-16,-9),(24,-9),(-12,13),(23,13)]:bench(root,x,y,math.pi if y<0 else 0)
    for x,y in [(-26,-16),(26,-16),(-25,13),(25,13)]:lamp(root,x,y)
    # A few real paving joints, drains and scattered autumn leaves survive close views.
    details=Boxes(root)
    for x in range(-48,49,2):details.add((x,-27.5,.151),(.014,2.85,.008),M['coping'])
    for x in [-25,0,25]:
        details.add((x,-22.1,.095),(1.0,.6,.04),M['dark'])
        for i in range(7):details.add((x-.42+i*.14,-22.1,.12),(.025,.55,.018),M['frame'])
    for i in range(500):
        x=rng.uniform(-29,29);y=rng.choice([-26.7,-25.9,-14,-11])+rng.uniform(-.35,.35)
        details.add((x,y,.16),(.13,.07,.009),LEAVES[rng.randrange(len(LEAVES))],rng.random()*math.tau)
    details.finish('Small courtyard details',.005)
    if kind in [8,9]:
        water=material('Reflective river water',(.035,.14,.16),.35,.18,.045)
        box('River',(39,4,-.12),(16,170,.18),water,root,.1)
        box('River granite parapet',(30.5,4,.45),(.55,76,.9),M['coping'],root,.06)
        box('Embankment walkway',(27.8,4,.08),(4.9,76,.18),M['paving'],root,.04)
        for y in range(-29,39,5):
            for z in [.75,1.1]:rod('Promenade railing',(30.4,y,z),(30.4,y+5,z),.028,M['frame'],root)
            rod('Promenade post',(30.4,y,.5),(30.4,y,1.2),.045,M['frame'],root)
    car(root,'uaz39094-utility',(-3,-19,.08),math.pi/2)
    car(root,'gazelle-next-van',(15,-19,.08),math.pi/2)
    car(root,'express',(-18,-19,.08),math.pi/2)
    car(root,'van',(30,-19,.08),math.pi/2)
    car(root,'gazon-next-flatbed',(-14,-32,.08),math.pi/2)
    return root

kinds=[args.only] if args.only is not None else list(range(10))
roots=[]
for kind in kinds:
    root=courtyard(kind);roots.append((kind,root));show(root,False)
cam=camera('Courtyard editorial camera',(79,-98,75),(0,0,8),112)
for kind,root in roots:
    show(root,True)
    cam.data.ortho_scale=114 if kind==2 else 105
    cam.location=(79,-98,84 if kind==2 else 72);target=Vector((0,2,14 if kind==2 else 7));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    if not args.no_render:render(OUT/'raw'/('courtyard-'+str(kind)+'.png'),1280 if args.preview else 960,800 if args.preview else 600,64 if args.preview else 40)
    show(root,False)
for index,(kind,root) in enumerate(roots):show(root,True);root.location=((index%5)*280,(index//5)*240,0)
cam.location=(840,-950,950);cam.rotation_euler=(Vector((540,110,8))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=1660
source_name='neighborhood-library.blend' if args.only is None else 'courtyard-'+str(args.only)+'.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'source'/source_name),compress=True)
print('UPRAVDOM_NEIGHBORHOODS_COMPLETE',len(roots),flush=True)
