"""Build the editable municipal fleet and render transparent game sprite layers.

blender -b -t 3 --python art/blender/build_fleet.py -- --preview --only uaz39094-utility
All geometry is authored here; the supplied vehicle photographs guide proportions.
"""
import bpy, sys, math, json, argparse
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from common import *

parser=argparse.ArgumentParser();parser.add_argument('--output',default=str(Path(__file__).resolve().parent/'build'));parser.add_argument('--only');parser.add_argument('--preview',action='store_true');parser.add_argument('--sprites',action='store_true');parser.add_argument('--mechanisms',action='store_true');parser.add_argument('--gallery',action='store_true');parser.add_argument('--resume',action='store_true');args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
OUT=Path(args.output);(OUT/'raw').mkdir(parents=True,exist_ok=True);(OUT/'source').mkdir(exist_ok=True);(OUT/'renders').mkdir(exist_ok=True)
reset();scene=studio(48)
def export_frame(path,w,h,samples):
    if args.resume and path.exists():return
    render(path,w,h,samples)
def rig_view(spec):
    factor=4.0 if spec.get('mechanism')=='articulated' else 2.65 if spec.get('mechanism')=='lattice' else 2.05
    return spec['length']*factor
M={
 'rubber':material('Tyres · satin vulcanised rubber',(.018,.022,.026),0,.85,.22),
 'black':material('Chassis · powder coat',(.035,.047,.052),.48,.48,.12),
 'steel':material('Brushed galvanised steel',(.44,.5,.52),.8,.32,.055),
 'silver':material('Polished piston steel',(.65,.73,.76),.92,.16),
 'glass':material('Smoked automotive glass',(.035,.085,.12),.48,.14),
 'reflection':material('Windshield sky reflection',(.2,.36,.42),.55,.2),
 'red':material('Safety vermilion paint',(.55,.025,.018),.4,.3),
 'yellow':material('Crane safety yellow',(.83,.49,.025),.42,.3),
 'white':material('Warm white enamel',(.8,.82,.76),.25,.35),
 'lamp':material('Headlight glass',(.93,.89,.62),.1,.18,emission=.45),
 'tail':material('Tail light lens',(.65,.018,.013),.15,.22,emission=.4),
 'amber':material('Amber beacon lens',(.95,.36,.025),.2,.18,emission=.8),
 'blue':material('Blue emergency beacon',(.018,.11,.8),.2,.17,emission=.5),
 'wood':material('Weathered larch cargo boards',(.29,.2,.105),0,.86,.25),
 'canvas':material('Twill canvas',(.75,.48,.04),0,.91,.3),
 'plate':material('Number plates',(.75,.78,.75),.15,.5)
}

# Dimensions are an artistic approximation, not manufacturer CAD certification.
SPECS=[
 dict(id='van',cab='van',length=5.2,width=2.0,color=(.49,.57,.55),legacy=54,service=True),
 dict(id='express',cab='compact',length=4.35,width=1.83,color=(.8,.82,.77),legacy=48,service=True),
 dict(id='truck',cab='bonnet',length=5.8,width=2.1,color=(.33,.43,.4),legacy=62,bed='utility'),
 dict(id='kamaz-crane',cab='heavy',length=10.6,width=2.52,color=(.025,.18,.39),legacy=94,kind='crane',mechanism='telescopic',axles=4),
 dict(id='gazelle-next-van',cab='van',length=5.7,width=2.05,color=(.58,.64,.64),legacy=54,service=True),
 dict(id='gaz53-scissor-lift',cab='bonnet',length=6.3,width=2.28,color=(.77,.67,.43),legacy=65,kind='lift',mechanism='scissor'),
 dict(id='gaz53-aerial-lift',cab='bonnet',length=6.6,width=2.28,color=(.17,.42,.52),legacy=70,kind='lift',mechanism='articulated'),
 dict(id='gaz3307-tipper',cab='bonnet',length=6.45,width=2.3,color=(.77,.79,.68),legacy=65,kind='tipper',mechanism='tipper',bedcolor=(.025,.28,.13)),
 dict(id='gazon-next-flatbed',cab='modern-truck',length=6.45,width=2.35,color=(.43,.28,.18),legacy=66,bed='flatbed'),
 dict(id='kamaz6520-tipper',cab='heavy',length=7.7,width=2.5,color=(.82,.17,.025),legacy=79,kind='tipper',mechanism='tipper',axles=3),
 dict(id='maz-tipper',cab='heavy',length=7.85,width=2.5,color=(.9,.21,.025),legacy=80,kind='tipper',mechanism='tipper',axles=3),
 dict(id='gazelle-business-flatbed',cab='double',length=5.9,width=2.05,color=(.8,.82,.79),legacy=56,bed='flatbed'),
 dict(id='uaz39094-utility',cab='uaz',length=4.8,width=1.95,color=(.91,.58,.015),legacy=46,bed='canvas'),
 dict(id='maz-crane',cab='heavy',length=10.25,width=2.5,color=(.62,.035,.025),legacy=92,kind='crane',mechanism='ladder',axles=4),
 dict(id='gazelle-next-aerial-lift',cab='modern-truck',length=6.3,width=2.05,color=(.23,.52,.65),legacy=64,kind='lift',mechanism='articulated'),
 dict(id='uaz2206-minibus',cab='uaz-bus',length=4.35,width=1.94,color=(.71,.72,.66),legacy=44,service=True),
 dict(id='gaz53-ks1571-crane',cab='bonnet',length=7.0,width=2.3,color=(.085,.25,.43),legacy=75,kind='crane',mechanism='lattice'),
]

def loft(name,sections,mat,parent):
    vertices=[]
    for y,w,z0,z1 in sections:
        chamfer=min(.16,w*.15)
        for x,z in [(-w,z0),(-w,z1-.18),(-w+chamfer,z1-.035),(-w+.24,z1),(w-.24,z1),(w-chamfer,z1-.035),(w,z1-.18),(w,z0)]:vertices.append((x,y,z))
    faces=[tuple(range(7,-1,-1)),tuple(range((len(sections)-1)*8,len(sections)*8))]
    for i in range(len(sections)-1):
        for j in range(8):faces.append((i*8+j,i*8+(j+1)%8,(i+1)*8+(j+1)%8,(i+1)*8+j))
    return mesh(name,vertices,faces,mat,parent,.045)

def wheel(root,x,y,radius=.44,dual=False):
    side=1 if x>0 else -1
    cylinder('Tyre carcass',(x,y,radius),radius,.25,M['rubber'],root,'X',32)
    for dx in [-.09,.09]:
        torus('Sidewall moulding',(x+dx,y,radius),radius*.87,.035,M['rubber'],root,'X')
    hubx=x+side*.135
    cylinder('Pressed steel rim',(hubx,y,radius),radius*.55,.02,M['steel'],root,'X')
    cylinder('Wheel hub',(hubx+side*.025,y,radius),radius*.24,.06,M['black'],root,'X')
    for i in range(6):
        angle=math.tau*i/6;cylinder('Hub bolt',(hubx+side*.02,y+math.sin(angle)*radius*.37,radius+math.cos(angle)*radius*.37),.026,.025,M['silver'],root,'X',8)
    # Tread shoulders are actual geometry, visible in both the turntable and sprites.
    for i in range(20):
        angle=math.tau*i/20
        tread=box('Tyre tread block',(x,y+math.sin(angle)*radius*.975,radius+math.cos(angle)*radius*.975),(.25,.045,.028),M['rubber'],root,.008);tread.rotation_euler[0]=-angle
    if dual:cylinder('Inner twin tyre',(x-side*.27,y,radius),radius,.22,M['rubber'],root,'X',24)

def side_window(root,side,y0,y1,z0,z1,width):
    x=side*(width/2+.006)
    quad('Window surround',[(x,y0,z0),(x,y1,z0),(x,y1-.09,z1),(x,y0+.08,z1)],M['black'],root)
    x+=side*.008
    quad('Side glazing',[(x,y0+.055,z0+.045),(x,y1-.055,z0+.045),(x,y1-.13,z1-.045),(x,y0+.12,z1-.045)],M['glass'],root)

def front_details(root,front,width,z,paint,round_lamps=False):
    box('Front bumper',(0,front+.06,.53),(width+.13,.18,.18),M['black'],root,.07)
    box('Grille surround',(0,front+.08,z),(width*.58,.08,.31),M['steel'],root,.035)
    for i in range(8):box('Grille slot',((i-3.5)*width*.055,front+.13,z),(.055,.035,.22),M['black'],root,.01)
    for side in [-1,1]:
        if round_lamps:cylinder('Round sealed beam',(side*width*.36,front+.12,z+.08),.135,.06,M['lamp'],root,'Y')
        else:box('Headlight cluster',(side*width*.35,front+.12,z+.06),(width*.22,.07,.145),M['lamp'],root,.025)
        box('Front indicator',(side*width*.39,front+.13,z-.11),(.12,.04,.055),M['amber'],root,.012)
        rod('Mirror arm',(side*width*.47,front-.48,z+.55),(side*(width*.5+.18),front-.6,z+.65),.018,M['black'],root)
        box('Wing mirror',(side*(width*.5+.19),front-.58,z+.69),(.12,.2,.19),M['black'],root,.045)
    box('Front registration plate',(0,front+.165,.57),(.44,.02,.095),M['plate'],root,.01)
    text('Service number','УЮТ 01',(0,front+.18,.54),.065,M['black'],root,(math.pi/2,0,0))

def cab(root,s,paint):
    length,width=s['length'],s['width'];front=length/2-.08;typ=s['cab']
    if typ in ['van','compact']:
        roof=2.43 if typ=='van' else 2.05
        loft('Continuous pressed van body',[(front,width*.39,.5,1.2),(front-.35,width*.46,.48,1.55),(front-1.14,width*.49,.5,roof-.04),(-length/2+.17,width*.49,.5,roof),(-length/2+.04,width*.46,.5,roof-.1)],paint,root)
        quad('Panoramic windscreen',[(-width*.37,front-.37,1.59),(width*.37,front-.37,1.59),(width*.37,front-1.1,roof-.065),(-width*.37,front-1.1,roof-.065)],M['glass'],root)
        for side in [-1,1]:
            side_window(root,side,front-1.7,front-.67,1.35,roof-.16,width*.98)
            box('Sliding door track',(side*width*.497,-.45,1.38),(.018,length*.43,.027),M['steel'],root,.008)
            box('Door handle',(side*width*.503,front-1.66,1.25),(.04,.19,.045),M['black'],root,.012)
        for x in [-.56,-.28,0,.28,.56]:box('Roof pressing',(x,-.65,roof+.015),(.027,length*.43,.016),paint,root,.008)
        for x in [-width*.23,width*.23]:box('Rear door hinge strap',(x,-length/2+.025,1.2),(.065,.04,.8),M['steel'],root,.014)
        front_details(root,front,width,1.0,paint)
        return
    if typ in ['uaz','uaz-bus']:
        back=-length/2+.07 if typ=='uaz-bus' else .03
        loft('Rounded UAZ cab',[(front,width*.38,.48,1.68),(front-.17,width*.48,.45,2.02),(front-.55,width*.5,.45,2.18),(back+.16,width*.5,.45,2.18),(back,width*.46,.45,2.06)],paint,root)
        y=front-.15
        for side in [-1,1]:
            vertices=[]
            for wy,wz in [(front+.028,1.39),(front+.028,1.67),(front-.12,1.96)]:
                vertices.extend([(side*.045,wy,wz),(side*width*.36,wy,wz)])
            mesh('Curved split windscreen',vertices,[(0,1,3,2),(2,3,5,4)],M['glass'],root)
            if typ=='uaz':
                side_window(root,side,.18,.89,1.35,2.03,width)
                side_window(root,side,.98,front-.47,1.35,2.03,width)
                box('Door shut line',(side*width*.502,.95,.94),(.008,.012,.64),M['black'],root,.002)
                box('Front door handle',(side*width*.504,1.13,1.12),(.04,.18,.04),M['steel'],root,.012)
            else:side_window(root,side,.22,front-.47,1.35,2.03,width)
            box('Side door handle',(side*(width*.5+.012),.52,1.12),(.04,.18,.04),M['steel'],root,.015)
            if typ=='uaz-bus':
                for cy in [-1.45,-.72,.0]:side_window(root,side,cy-.25,cy+.25,1.3,1.99,width)
            else:
                box('Emergency stripe',(side*(width*.501),front-1.05,.99),(.018,1.25,.15),M['red'],root,.008)
        front_details(root,front,width,1.01,paint,True)
        if typ=='uaz':
            for x in [-.15,.15]:quad('Painted roof stripe',[(x-.06,.14,2.184),(x+.06,.14,2.184),(x+.06,front-.65,2.184),(x-.06,front-.65,2.184)],M['red'],root)
            for x in [-.48,.48]:
                cylinder('Beacon mounting foot',(x,front-.75,2.205),.105,.045,M['black'],root)
                sphere('Rotating beacon lens',(x,front-.75,2.28),(.085,.085,.105),M['blue'],root)
            for side in [-1,1]:
                rod('Windscreen wiper',(side*.17,front+.04,1.42),(side*.3,front+.04,1.67),.012,M['black'],root,8)
                rod('Wiper blade',(side*.3,front+.04,1.67),(side*.37,front-.055,1.82),.012,M['black'],root,8)
        return
    heavy=typ=='heavy';modern=typ in ['modern-truck','double'];hood=0 if heavy else .95 if modern else 1.3
    rear=front-hood-(1.9 if heavy else 2.25 if typ=='double' else 1.7 if modern else 1.65)
    roof=2.8 if heavy else 2.48 if modern else 2.45
    cabfront=front-hood
    loft('Steel cab shell',[(cabfront,width*.43,.65,roof-.18),(cabfront-.17,width*.48,.65,roof),(rear+.1,width*.48,.65,roof),(rear,width*.43,.65,roof-.1)],paint,root)
    if not heavy:
        loft('Curved engine bonnet',[(front,width*.31,.65,1.33),(front-.2,width*.36,.65,1.5),(cabfront,width*.36,.65,1.55)],paint,root)
    for side in [-1,1]:
        side_window(root,side,rear+.17,cabfront-.15,1.48,roof-.14,width*.96)
        box('Door handle',(side*width*.485,rear+.32,1.35),(.04,.17,.045),M['steel'],root,.012)
        box('Cab step',(side*(width*.47),rear+.5,.45),(.3,.62,.09),M['steel'],root,.025)
        quad('Split front glass',[(side*.04,cabfront+.026,1.55),(side*width*.37,cabfront+.026,1.55),(side*width*.37,cabfront+.026,roof-.25),(side*.04,cabfront+.026,roof-.25)],M['glass'],root)
        if not heavy:
            fender=box('Rounded wing',(side*width*.39,front-.7,.99),(width*.31,1.36,.17),paint,root,.08)
        else:
            box('Cab wing',(side*width*.44,cabfront-.85,.95),(.35,1.5,.22),paint,root,.09)
    front_details(root,front if not heavy else cabfront+.02,width,1.03,paint,not modern and not heavy)
    if heavy:
        box('Cab roof hatch',(0,cabfront-.75,roof+.025),(.66,.59,.035),M['black'],root,.06)
        for x in [-.7,.7]:cylinder('Amber roof beacon',(x,cabfront-.5,roof+.12),.085,.13,M['amber'],root)
    return rear

def cargo(root,s,paint):
    length,width=s['length'],s['width'];rear=-length/2+.12
    front=.05 if s['cab']=='uaz' else s.get('cabRear',length/2-2.75)-.08
    center=(front+rear)/2;size=front-rear
    box('Cargo deck',(0,center,.92),(width*.94,size,.18),M['black'],root,.035)
    for x in [-width*.42,width*.42]:box('Rubber mudguard',(x,center-.45,.8),(.36,1.5,.12),M['rubber'],root,.05)
    if s.get('bed')=='canvas':
        sections=[]
        for y in [rear,front]:
            for i in range(13):
                a=math.pi*i/12;sections.append((math.cos(a)*width*.45,y,1.35+math.sin(a)*.73))
        faces=[tuple(range(12,-1,-1)),tuple(range(13,26))]+[(i,i+1,i+14,i+13) for i in range(12)]
        mesh('Tensioned canvas cover',sections,faces,M['canvas'],root,.015)
        for y in [rear+.03,center,front-.03]:
            for i in range(12):rod('Canvas bow piping',sections[i][:1]+(y,sections[i][2]+.012),sections[i+1][:1]+(y,sections[i+1][2]+.012),.012,M['yellow'],root,8)
        for side in [-1,1]:
            box('Canvas sideboard',(side*width*.45,center,1.15),(.06,size,.48),paint,root,.018)
            box('Service identification stripe',(side*width*.483,center,1.23),(.018,size-.1,.16),M['red'],root,.005)
        box('Closed rear canvas curtain',(0,rear-.012,1.24),(width*.89,.025,.44),M['canvas'],root,.012)
        box('Tailboard',(0,rear-.04,1.02),(width*.94,.07,.28),paint,root,.022)
        for x in [-width*.35,width*.35]:box('Curtain securing strap',(x,rear-.032,1.36),(.035,.013,.6),M['yellow'],root,.008)
        for x in [-.15,.15]:box('Canvas emergency stripe',(x,center,2.073),(.12,size,.012),M['red'],root,.004)
    elif not s.get('mechanism'):
        for i in range(7):box('Bed plank',((i-3)*width*.12,center,1.025),(width*.115,size-.08,.04),M['wood'],root,.009)
        for side in [-1,1]:
            box('Aluminium sideboard',(side*width*.46,center,1.28),(.06,size,.5),M['steel'],root,.022)
            for y in [rear+.12,center,front-.12]:box('Sideboard latch',(side*width*.494,y,1.25),(.026,.08,.4),M['black'],root,.008)
        for y in [rear,front]:box('End board',(0,y,1.28),(width*.94,.06,.5),M['steel'],root,.02)
        if s.get('bed')=='utility':
            box('Tool chest',(-.4,center+.45,1.35),(.65,.8,.62),M['yellow'],root,.06)
            for i in range(3):cylinder('Pipe stock',(.36,center,1.19+i*.11),.055,size*.75,M['steel'],root,'Y')

def basket(parent,loc,size=(.9,.82)):
    x,y,z=loc;w,l=size
    box('Platform non-slip floor',(x,y,z),(w,l,.09),M['steel'],parent,.035)
    for sx in [-1,1]:
        for sy in [-1,1]:rod('Basket guard post',(x+sx*w/2,y+sy*l/2,z),(x+sx*w/2,y+sy*l/2,z+.73),.027,M['yellow'],parent)
    for level in [.35,.73]:
        for sx in [-1,1]:rod('Basket guardrail',(x+sx*w/2,y-l/2,z+level),(x+sx*w/2,y+l/2,z+level),.026,M['yellow'],parent)
        for sy in [-1,1]:rod('Basket guardrail',(x-w/2,y+sy*l/2,z+level),(x+w/2,y+sy*l/2,z+level),.026,M['yellow'],parent)

def mechanism(root,s):
    typ=s.get('mechanism')
    if not typ:return None,None
    pivot=-1.35 if typ=='scissor' else -1.0 if typ=='articulated' else -.65 if s['length']<8 else -.25
    base=2.4 if typ in ['telescopic','ladder'] else 2.1 if typ=='lattice' else 2.3 if typ=='articulated' else 1.2
    upper=empty('Upper mechanism · independent azimuth',root);upper.location=(0,pivot,base)
    if typ!='tipper':
        cylinder('Slew pedestal',(0,pivot,(1.0+base)/2),.45,base-1.0,M['steel'],root)
        box('Pedestal reinforcement',(0,pivot,1.06),(1.2,1.3,.17),M['black'],root,.04)
    upper['deployment']=0.;upper['aim_degrees']=0.;upper['mechanism']=typ
    def clear():
        for obj in list(upper.children_recursive):bpy.data.objects.remove(obj,do_unlink=True)
    def pose(d,aim=0):
        clear();upper.rotation_euler[2]=-aim
        if typ=='tipper':
            upper.rotation_euler[2]=0
            bed=empty('Hydraulic rear hinge',upper);bed.location=(0,-s['length']/2-pivot+.15,.05);bed.rotation_euler[0]=math.radians(40)*d
            length=s.get('cabRear',s['length']/2-2.4)-.1+s['length']/2-.15;width=s['width']*.95
            paint=material('Tipper bed enamel '+s['id'],s.get('bedcolor',s['color']),.35,.45,.12)
            box('Steel tipper floor',(0,length/2,0),(width,length,.15),paint,bed,.045)
            for side in [-1,1]:
                box('Tipper side',(side*width/2,length/2,.47),(.12,length,.95),paint,bed,.04)
                for y in [.12,length*.27,length*.5,length*.73,length-.12]:box('Tipper stiffener',(side*(width/2+.055),y,.5),(.07,.1,.9),paint,bed,.018)
            for y in [0,length]:box('End gate',(0,y,.47),(width,.1,.95),paint,bed,.04)
            for y in [length*.25,length*.5,length*.75]:box('Raised bed pressing',(0,y,.09),(width*.94,.065,.06),paint,bed,.02)
            angle=math.radians(40)*d;hinge=bed.location
            start=Vector((0,hinge.y+length*.2,-.45))
            anchor=Vector((0,hinge.y+length*.65*math.cos(angle),hinge.z+length*.65*math.sin(angle)-.12))
            middle=start+(anchor-start).normalized()*(length*.28)
            rod('Hydraulic ram barrel',start,middle,.115,M['black'],upper)
            rod('Polished lift piston',middle,anchor,.065,M['silver'],upper)
        else:
            cylinder('Slew ring',(0,0,0),.57,.2,M['black'],upper)
            box('Counterweight',(0,-.65,.25),(1.05,.85,.5),M['yellow'] if typ!='ladder' else M['red'],upper,.11)
            if typ=='scissor':
                upper.rotation_euler[2]=0
                h=.16+d*1.8;l=math.sqrt(2.17**2-h**2)
                for side in [-1,1]:
                    for level in range(3):
                        z=.2+level*h
                        rod('Scissor crossed link',(side*.62,-l/2,z),(side*.62,l/2,z+h),.042,M['red'],upper)
                        rod('Scissor crossed link',(side*.62,l/2,z),(side*.62,-l/2,z+h),.042,M['red'],upper)
                        cylinder('Scissor joint pin',(side*.65,0,z+h/2),.072,.1,M['silver'],upper,'X')
                basket(upper,(0,0,.2+3*h),(1.7,2.65))
            elif typ=='articulated':
                # Fixed-length articulated sections unfold at real pivots.
                # The second section is folded back above the vehicle in travel.
                first=math.radians(2+76*d);second=math.radians(183-117*d)
                a=(0,0,.85);b=(0,4.6*math.cos(first),a[2]+4.6*math.sin(first));c=(0,b[1]+4.4*math.cos(second),b[2]+4.4*math.sin(second))
                box('Aerial pivot tower',(0,0,.4),(.48,.52,.8),M['white'],upper,.04)
                for p,q,paint,r in [(a,b,M['yellow'],.105),(b,c,M['white'],.085)]:
                    rod('Lift box boom',p,q,r,paint,upper,4)
                    start=(p[0]+.16,p[1]+.35,p[2]-.25);anchor=(q[0]+.16,p[1]+(q[1]-p[1])*.42,p[2]+(q[2]-p[2])*.42)
                    middle=Vector(start)+(Vector(anchor)-Vector(start)).normalized()*.75
                    rod('Lift cylinder barrel',start,middle,.055,M['steel'],upper)
                    rod('Lift polished piston',middle,anchor,.035,M['silver'],upper)
                for p in [a,b,c]:cylinder('Pivot bearing',p,.13,.34,M['black'],upper,'X')
                basket(upper,(0,c[1]+.35,c[2]),(.96,.85))
            else:
                reach=3.9+d*(3.7 if s['length']>8 else 2.7);rise=.12+d*1.3
                if typ=='telescopic':
                    reach=max(i*(.3+d*2.05)+3.8-i*.45 for i in range(3))
                    for i in range(3):
                        start=i*(.3+d*2.05);end=start+3.8-i*.45
                        rod('Nested telescopic boom',(0,start,.45+start/reach*rise),(0,end,.45+end/reach*rise),.22-i*.045,M['white'] if i<2 else M['steel'],upper,4)
                    rod('Boom lift ram',(.25,0,.05),(.25,2.5,.4+d*.55),.08,M['silver'],upper)
                else:
                    width=.45 if typ=='ladder' else .34
                    for side in [-1,1]:
                        for level in [0,.28]:rod('Space frame chord',(side*width,0,.3+level),(side*width,reach,.3+level+rise),.033,M['steel'] if typ=='ladder' else M['yellow'],upper)
                    segments=18
                    for i in range(segments):
                        y=i*reach/segments;yn=(i+1)*reach/segments;z=.3+y/reach*rise;zn=.3+yn/reach*rise
                        rod('Ladder rung',(-width,y,z+.12),(width,y,z+.12),.022,M['steel'],upper)
                        for side in [-1,1]:rod('Lattice diagonal',(side*width,y,z),(side*width,yn,zn+.28),.022,M['yellow'] if typ=='lattice' else M['white'],upper)
                cylinder('Winch drum',(0,-.06,.61),.22,.6,M['steel'],upper,'X')
                rod('Hoist rope',(0,reach,.5+rise),(0,reach,.18),.018,M['black'],upper)
                box('Hook block',(0,reach,.16),(.3,.22,.3),M['yellow'],upper,.055)
                cylinder('Hook sheave',(0,reach,.16),.12,.32,M['black'],upper,'X')
        target=root.users_collection[0]
        for obj in upper.children_recursive:
            for old in list(obj.users_collection):old.objects.unlink(obj)
            target.objects.link(obj)
    pose(0);return upper,pose

def build(s):
    root=empty(s['id']+' · complete vehicle');body=empty('Chassis and body',root)
    paint=material('Body paint · '+s['id'],s['color'],.52,.29,.025)
    l,w=s['length'],s['width'];r=.49 if s['cab']=='heavy' else .38 if s['cab'].startswith('uaz') else .43
    for x in [-.44,.44]:box('Chassis rail',(x,-.3,.64),(.13,l-.65,.2),M['black'],body,.025)
    axles=([l/2-1.05,l/2-2.65,-l/2+2.2,-l/2+.8] if s.get('axles')==4 else [l/2-1.05,-l/2+1.9,-l/2+.65] if s.get('axles')==3 else [l/2-.95,-l/2+1.0])
    for y in axles:
        cylinder('Axle',(0,y,r),.085,w-.15,M['black'],body,'X')
        cylinder('Differential',(0,y,r),.19,.32,M['black'],body,'X')
        for side in [-1,1]:wheel(body,side*(w/2-.1),y,r,side and len(axles)>2 and y<0)
    cylinder('Fuel tank',(-w*.37,-.35,.57),.24,1.0,M['steel'],body,'Y')
    box('Battery box',(w*.36,-.25,.6),(.42,.8,.42),M['black'],body,.045)
    rear=cab(body,s,paint)
    if rear is not None:s['cabRear']=rear
    if not s.get('service'):cargo(body,s,paint)
    for side in [-1,1]:
        box('Rear lamp',(side*w*.36,-l/2,.68),(.24,.045,.11),M['tail'],body,.02)
        box('Rear mudflap',(side*w*.39,-l/2+.32,.28),(.42,.045,.4),M['rubber'],body,.018)
    if s['id']=='van':
        for side in [-1,1]:rod('Roof ladder rail',(side*.24,-1.6,2.58),(side*.24,.65,2.58),.025,M['steel'],body)
        for i in range(9):rod('Ladder rung',(-.24,-1.5+i*.25,2.58),(.24,-1.5+i*.25,2.58),.02,M['steel'],body)
    upper,pose=mechanism(root,s)
    collection=bpy.data.collections.new(s['id']);bpy.context.scene.collection.children.link(collection)
    for obj in descendants(root):
        for old in list(obj.users_collection):old.objects.unlink(obj)
        collection.objects.link(obj)
    root['Reference']='Original geometry; proportions guided by supplied fleet photographs';root['Metres']=l;root['Model']=s['id']
    return dict(root=root,body=body,upper=upper,pose=pose,spec=s)

fleet=[build(s) for s in SPECS if not args.only or s['id']==args.only]
(OUT/'fleet-metadata.json').write_text(json.dumps([{**item['spec'],'bodyView':item['spec']['length']*1.85,'bodyCell':192,'rigView':rig_view(item['spec']),'pivot':item['upper'].location.y if item['upper'] else 0} for item in fleet],indent=2))
ground=box('Transparent shadow catcher',(0,0,-.035),(100,100,.05),M['white'],bevel=0);ground.is_shadow_catcher=True
cam=camera('Orthographic game camera',(0,0,35),(0,0,0),12)
for item in fleet:show(item['root'],False)
manifest={}
for row,item in enumerate(fleet):
    s=item['spec'];root=item['root'];show(root,True)
    if args.preview:
        cam.location=(10,14,11);cam.rotation_euler=(Vector((0,0,1))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=s['length']*1.35
        export_frame(OUT/'renders'/(s['id']+'-preview.png'),1100,850,96)
    if args.sprites:
        if item['upper']:show(item['upper'],False)
        cam.location=(0,0,35);cam.rotation_euler=(0,0,0);cam.data.ortho_scale=s['length']*1.85
        for angle in range(16):
            root.rotation_euler[2]=-angle*math.tau/16
            export_frame(OUT/'raw'/(s['id']+'-body-'+str(angle)+'.png'),192,192,32)
        root.rotation_euler[2]=0
        if item['upper']:show(item['upper'],True);item['pose'](0)
        cam.location=(5,12,9);cam.rotation_euler=(Vector((0,0,1))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=s['length']*1.5
        export_frame(OUT/'raw'/(s['id']+'-garage.png'),320,384,64)
    if args.mechanisms and item['upper']:
        show(root,False);show(item['upper'],True);root.rotation_euler[2]=0
        pivot=item['upper'].location.y;cam.location=(0,pivot,35);cam.rotation_euler=(0,0,0);view=rig_view(s);cam.data.ortho_scale=view
        for deployment in range(5):
            d=deployment/4
            for angle in range(8):
                # Scissors and tipper beds do not slew independently. Rotate
                # their chassis frame for the export, retaining world lighting.
                fixed=s.get('mechanism') in ['scissor','tipper']
                a=angle*math.tau/8
                root.rotation_euler[2]=-a if fixed else 0
                cam.location=(math.sin(a)*pivot,math.cos(a)*pivot,35) if fixed else (0,pivot,35)
                item['pose'](d,0 if fixed else angle*math.tau/8)
                export_frame(OUT/'raw'/(s['id']+'-rig-'+str(deployment)+'-'+str(angle)+'.png'),256,256,32)
        manifest[s['id']]={'view':view,'pivot':pivot,'metres':s['length'],'worldLength':s['legacy']}
        root.rotation_euler[2]=0;item['pose'](0);show(root,True)
    show(root,False)

# The .blend opens as an editable, labelled fleet layout with all parts retained.
ground.is_shadow_catcher=False;ground.data.materials.clear();ground.data.materials.append(material('Showroom slate',(.035,.055,.069),.15,.5))
for index,item in enumerate(fleet):
    show(item['root'],True);item['root'].location=((index%4-1.5)*13,(index//4-2)*16,0);item['root'].rotation_euler[2]=-.35
    if item['pose']:item['pose'](.5 if args.gallery else 0)
    text('Vehicle label',item['spec']['id'],(item['root'].location.x,item['root'].location.y-7,.02),.4,M['white'])
cam.location=(52,-78,78);cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=99
scene.render.resolution_x=2000;scene.render.resolution_y=1800
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'source'/'municipal-fleet.blend'),compress=True)
if args.gallery:render(OUT/'renders'/'fleet-showroom.png',2200,2000,64)
(OUT/'mechanisms.json').write_text(json.dumps(manifest,indent=2))
print('UPRAVDOM_FLEET_RENDER_COMPLETE',len(fleet),flush=True)
