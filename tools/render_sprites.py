"""Generate original transparent isometric game sprites with Blender.
Usage: blender -b -t 2 --python tools/render_sprites.py -- --output web/assets/rendered
No stock meshes, fonts, private references, network services or runtime dependencies.
"""
import bpy, math, os, sys, random
from mathutils import Vector, Matrix
from math import radians

OUTPUT = "web/assets/rendered"
args = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
if "--output" in args:
    OUTPUT = args[args.index("--output")+1]
os.makedirs(OUTPUT, exist_ok=True)
random.seed(7)

def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def material(name, color, rough=.75, metallic=0, glow=0):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color=(*color, 1)
    m.use_nodes=True
    bs=m.node_tree.nodes.get("Principled BSDF")
    if bs:
        bs.inputs["Base Color"].default_value=(*color,1)
        bs.inputs["Roughness"].default_value=rough
        bs.inputs["Metallic"].default_value=metallic
        if glow:
            try:
                bs.inputs["Emission Color"].default_value=(*color,1)
                bs.inputs["Emission Strength"].default_value=glow
            except KeyError: pass
    return m

def box(name, location, size, mat, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj=bpy.context.object;obj.name=name
    obj.dimensions=size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        mod=obj.modifiers.new("Soft corners", 'BEVEL')
        mod.width=bevel;mod.segments=2
        if hasattr(mod, 'affect'): mod.affect='EDGES'
        mod2=obj.modifiers.new("Weighted normals", 'WEIGHTED_NORMAL')
    return obj

def cyl(name, location, radius, depth, mat, vertices=16, rotate=(0,0,0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=location,rotation=rotate)
    obj=bpy.context.object;obj.name=name;obj.data.materials.append(mat)
    return obj

def sphere(name, location, radius, mat, scale=(1,1,1), sub=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=radius, location=location)
    obj=bpy.context.object;obj.name=name
    obj.scale=scale;obj.data.materials.append(mat)
    return obj

def common(ortho, target_z):
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.samples=24
    bpy.context.view_layer.cycles.use_denoising=False
    scene.render.resolution_x=512;scene.render.resolution_y=512
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.render.image_settings.color_mode='RGBA'
    scene.render.film_transparent=True
    scene.render.image_settings.color_depth='8'
    scene.view_settings.view_transform='Standard'
    scene.view_settings.look='Medium High Contrast'
    scene.view_settings.exposure=0.35
    scene.render.filepath=''
    scene.camera=None
    world=bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    scene.world=world;world.use_nodes=True
    world.node_tree.nodes["Background"].inputs["Color"].default_value=(.49,.64,.74,1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value=.7
    bpy.ops.object.light_add(type='AREA', location=(-5,-8,16))
    key=bpy.context.object;key.name="Warm afternoon sun";key.data.energy=1500;key.data.shape='DISK';key.data.size=9
    key.rotation_euler=(Vector((0,0,target_z))-key.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=(14,-17,15))
    camera=bpy.context.object;scene.camera=camera
    camera.rotation_euler=(Vector((0,0,target_z))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=ortho
    scene.render.film_transparent=True
    scene.camera.data.lens=45

def render(filename):
    bpy.context.scene.render.filepath=os.path.join(OUTPUT,filename)
    bpy.ops.render.render(write_still=True)
    print("SPRITE_RENDERED", filename, flush=True)

def house(idx):
    clear();common(12.4,4.1)
    colors=[(.68,.47,.36),(.77,.62,.48),(.69,.67,.61),(.74,.52,.45)]
    c=colors[idx%4]
    wall=material("Brick",c)
    side=material("Brick west",tuple(x*.82 for x in c))
    trim=material("Facade accents",(.83,.76,.68))
    concrete=material("Roof bitumen",(.38,.43,.46))
    gravel=material("roof gravel",(.49,.52,.51))
    glass=material("Dark blue windows",(.075,.20,.26),rough=.15,metallic=.2)
    lit=material("Warm-lit windows",(.9,.61,.31),rough=.3,glow=.55)
    frame=material("Window surrounds",(.79,.77,.70))
    rail=material("Balcony ironwork",(.32,.38,.42),metallic=.45)
    door=material("Entrance",(.14,.24,.25))
    snow=material("Slight snow",(.86,.91,.92))
    leaves=[material("Maple",(.46,.51,.31)),material("Autumn",(.74,.47,.19)),material("Pine",(.15,.34,.23))]
    trunk=material("Bark",(.34,.26,.19))
    asphalt=material("Courtyard paving",(.47,.47,.46))
    grass=material("Grass",(.35,.46,.30))
    box("Pavement foundation",(0,0,-.09),(5.6,4.45,.18),asphalt)
    for i in range(26):
        x=random.uniform(-2.6,2.6);y=random.choice([-2.04,2.04])
        box("Paving texture",(x,y,0.012),(.09,.22,.025),trim)
    box("Apartment block",(0,0,4.13),(4.5,2.97,8.25),wall,.055)
    box("Sunny outer facade",(2.266,0,4.1),(.045,2.93,8.17),side)
    for z in [1.03,2.06,3.09,4.12,5.15,6.18,7.21]:
        box("Horizontal plaster joint",(0,-1.502,z),(4.47,.036,.027),trim)
        box("Side plaster joint",(2.285,0,z),(.028,2.9,.022),trim)
    # Windows and recessed trim on both visible faces.
    for floor in range(5):
        z=1.21+floor*1.41
        for col,x in enumerate([-1.72,-1.06,-.36,.36,1.06,1.72]):
            illuminated=(floor*7+col*11+idx*3)%7<3
            pane=lit if illuminated else glass
            box("Window moulding",(x,-1.523,z),(.49,.08,.68),frame,.018)
            box("Window pane",(x,-1.575,z),(.38,.025,.56),pane)
            box("Centre mullion",(x,-1.592,z),(.023,.025,.56),frame)
            box("Sill",(x,-1.574,z-.37),(.55,.12,.075),trim)
        for col,y in enumerate([-.98,-.30,.38,1.02]):
            pane=lit if (floor*5+col*9+idx*4)%6<2 else glass
            box("End wall window moulding",(2.30,y,z),(.085,.44,.66),frame)
            box("End wall glass",(2.355,y,z),(.02,.34,.54),pane)
            box("End wall sill",(2.35,y,z-.38),(.12,.53,.07),trim)
    # Balconies and railings, visible against facade.
    for floor in [1,3]:
        z=1.02+floor*1.41
        for x in [-1.10,1.1]:
            box("Balcony slab",(x,-1.89,z-.36),(.82,.75,.12),trim)
            box("Balcony railing horizontal",(x,-2.25,z+.26),(.84,.05,.065),rail)
            for dx in [-.36,-.18,0,.18,.36]:
                box("Balcony iron vertical",(x+dx,-2.25,z-.07),(.025,.04,.69),rail)
    box("Entry doorway",(0,-1.571,.63),(.8,.068,1.18),door)
    box("Awning",(0,-1.85,1.40),(1.12,.90,.10),concrete)
    for k in range(3):
        box("Entry steps",(0,-1.92-k*.15,.09+k*.028),(1.1,.17,.17),trim)
    # A roof with raised parapet, pipes, air ducts and snow patching.
    box("Roof",(0,0,8.33),(4.72,3.19,.20),concrete)
    for x in [-2.37,2.37]:
        box("Parapet",(x,0,8.52),(.14,3.24,.31),gravel)
    for y in [-1.58,1.58]:
        box("Parapet",(0,y,8.52),(4.71,.14,.31),gravel)
    for n in range(7):
        x=-1.75+random.random()*3.5;y=-.95+random.random()*1.95
        box("Ventilation block",(x,y,8.62),(.35,.42,.30),trim)
        box("Vent cap",(x,y,8.83),(.40,.47,.055),gravel)
    for n in range(16):
        x=random.uniform(-2,2);y=random.uniform(-1.33,1.33)
        box("Patchy snow",(x,y,8.45),(.13+.15*random.random(),.27,.019),snow)
    # Trees, foliage and street furniture anchored to building patch.
    for n,(x,y) in enumerate([(-2.55,-1.90),(-2.55,1.55),(2.60,-1.98),(2.51,1.60)]):
        cyl("Tree trunk",(x,y,.47),.060,.88,trunk)
        cl=leaves[(n+idx)%3]
        for dz,rad in [(.96,.46),(1.29,.39),(1.59,.27)]:
            sphere("Layered leaves",(x,y,dz),rad,cl,(1,1,.65))
    # Broader Russian slab blocks rather than short, square office-like towers.
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            obj.location.x *= 1.75
            if not obj.name.startswith(('Tree trunk','Layered leaves')):
                obj.scale.x *= 1.75
            # Five clearly legible storeys, proportioned as a low, long slab.
            obj.location.z *= .90
            obj.scale.z *= .90
    render(f"house_{idx+1:02d}.png")

def vehicle(i):
    clear();common(6.7,0.85)
    white=material("Gloss white painted steel",(.88,.93,.93),rough=.38)
    paint=[material("Emergency red",(.86,.11,.13)),
           material("Electrical yellow",(.99,.67,.055)),
           material("Maintenance blue",(.085,.47,.78))][i]
    navy=material("Service details",(.10,.19,.26),rough=.39)
    yellow=material("Reflective gold",(.95,.78,.18),rough=.3)
    tinted=material("Tinted auto glass",(.065,.17,.23),rough=.13,metallic=.36)
    windowshine=material("Glass reflections",(.44,.69,.78),rough=.18)
    rubber=material("Tire rubber",(.038,.049,.06),rough=.97)
    rim=material("Aluminum hub",(.64,.68,.68),rough=.24,metallic=.7)
    lights=material("Warm running lamps",(.97,.89,.66),rough=.24,glow=.7)
    redlight=material("Red lights",(.86,.07,.07),rough=.26,glow=.4)
    chrome=material("Painted mirror/bumper",(.35,.47,.52),metallic=.6)
    under=material("Undercarriage",(.12,.17,.21))
    # All vans have the same real-world wheelbase, cab doors and driveline.
    box("Long wheelbase",(-.05,.08,.46),(3.3,1.32,.23),under,.06)
    box("Cab / bonnet",(1.02,.08,.94),(1.22,1.28,1.04),white,.18)
    box("Windscreen",(1.655,.08,1.10),(.035,1.04,.52),tinted)
    box("Reflecting line",(1.679,.08,1.28),(.009,.98,.05),windowshine)
    box("Driver window",(1.10,-.58,1.20),(.62,.03,.37),tinted)
    box("Passenger window",(1.10,.74,1.20),(.62,.03,.37),tinted)
    box("Cab door seam",(1.00,-.605,.88),(.035,.025,.55),chrome)
    box("Door handle",(1.17,-.62,.93),(.14,.045,.045),chrome)
    box("Door panel stripe",(1.20,-.607,.67),(.43,.04,.12),paint)
    box("Left wing mirror",(1.42,-.76,1.18),(.15,.12,.18),navy,.04)
    box("Right wing mirror",(1.42,.89,1.18),(.15,.12,.18),navy,.04)
    box("Bonnet and grille",(1.62,.08,.70),(.10,.82,.22),navy,.03)
    box("Front bumper",(1.69,.08,.48),(.15,1.38,.16),chrome,.035)
    for y in [-.44,.57]:
        box("Headlight",(1.705,y,.77),(.045,.21,.12),lights,.02)
    for y in [-.45,.60]:
        box("Rear taillight",(-1.64,y,.61),(.052,.16,.18),redlight)
    for x in [-1.11,1.08]:
        for y in [-.63,.78]:
            cyl("Road wheel",(x,y,.36),.31,.20,rubber,32,rotate=(radians(90),0,0))
            cyl("Wheel hub",(x,y+(.13 if y>0 else -.13),.36),.17,.08,rim,28,rotate=(radians(90),0,0))
            cyl("Axle center",(x,y+(.175 if y>0 else -.175),.36),.045,.025,navy,16,rotate=(radians(90),0,0))

    if i != 2:
        # Full body van; yellow electricians use a noticeably taller equipment roof.
        roof=1.91 if i==1 else 1.77
        box("Cargo coachwork",(-.56,.07,1.12),(2.04,1.31,roof-.46),paint if i==1 else white,.115)
        box("Side body flash",(-.58,-.603,.83),(1.99,.038,.22),navy if i==1 else paint,.018)
        box("Service upper side decal",(-.72,-.61,1.32),(1.15,.031,.12),white if i==1 else paint)
        box("Rear double door seam",(-1.615,.07,1.11),(.035,1.17,1.12),navy)
        box("Body roof",(-.52,.07,roof+.005),(2.01,1.27,.075),white if i==0 else paint,.045)
        box("Left rear light",(-1.64,-.42,.90),(.06,.11,.26),redlight)
    else:
        # Blue maintenance pickup: exposed cargo bed, tailgate and equipment lockers.
        box("Pickup flatbed",(-.71,.07,.80),(1.83,1.35,.28),paint,.05)
        for yy in [-.59,.73]:
            box("Raised bed side",(-.79,yy,1.02),(1.74,.12,.47),paint,.045)
        box("Tailgate",(-1.60,.07,1.02),(.13,1.32,.49),white,.04)
        box("Service equipment box",(-.40,.07,1.20),(.73,.96,.54),white,.07)
        for bx in [-1.31,-1.03]:
            box("Steel tool case",(bx,.07,1.05),(.22,1.02,.25),navy,.025)
        box("Tailgate reflective strip",(-1.675,.07,.97),(.03,1.07,.10),white)

    # Type-specific tools: recognizable even at small map scale.
    if i==0:
        # Plumber's pipe rack and red hoses.
        for y in [-.40,.48]:
            box("Roof pipe rack",(-.55,y,1.95),(1.82,.06,.08),chrome)
            cyl("Rooftop copper pipe",(-.60,y,2.03),.075,1.40,paint,12,rotate=(0,radians(90),0))
        box("Emergency roof beacon",(1.03,.08,1.55),(.42,.23,.10),redlight,.025)
        box("Medical white side stripe",(-.52,-.628,.98),(1.36,.04,.10),white)
    elif i==1:
        # Electrical ladder is carried above the cargo deck.
        for y in [-.42,.53]:
            box("Aluminium ladder rail",(-.48,y,2.05),(1.82,.045,.09),rim)
        for j in range(7):
            box("Ladder rung",(-1.25+j*.255,.055,2.07),(.045,.99,.045),rim)
        box("Amber rotating beacon",(1.11,.08,1.58),(.42,.26,.13),yellow,.02)
        box("Electrical door insignia",(-.28,-.65,1.18),(.39,.035,.41),navy)
        box("Insignia bright slash",(-.28,-.68,1.20),(.075,.04,.43),yellow)
    else:
        box("Blue roof beacon",(1.02,.08,1.55),(.35,.25,.12),paint,.03)
        box("Spare part containers",(-1.05,.10,1.34),(.28,.65,.15),yellow,.02)
        # Upright cabin rack.
        for yy in [-.53,.69]:
            box("Pickup protection frame",(.09,yy,1.56),(.085,.08,.58),chrome,.02)
        box("Pickup frame horizontal",(.07,.08,1.85),(.10,1.26,.10),chrome)
    prefix=["van_water","van_electric","van_repair"][i]
    render(prefix+".png")
    # Four orthographic driving directions; rotate 3D geometry, never the flat PNG.
    # The camera and light remain fixed for consistent cast shadows and materials.
    original=[(obj,obj.matrix_world.copy()) for obj in bpy.context.scene.objects if obj.type=='MESH']
    for bearing,angle in [('north',-90),('west',180),('south',90)]:
        transform=Matrix.Rotation(radians(angle),4,'Z')
        for obj,matrix in original: obj.matrix_world=transform @ matrix
        render(prefix+"_"+bearing+".png")
    for obj,matrix in original: obj.matrix_world=matrix

def tree_sprite(kind):
    clear(); common(5.6,1.62)
    random.seed(129+kind)
    bark=material("Dark bark",(.31,.24,.17),rough=.98)
    leaf_green=[material("Leaf green",(.16,.38,.18)),
                material("Sunlit green",(.31,.51,.24)),
                material("Leaf olive",(.32,.43,.21))]
    leaf_autumn=[material("Amber leaves",(.87,.45,.12)),
                 material("Autumn gold",(.94,.66,.21)),
                 material("Olive highlights",(.54,.54,.20)),
                 material("Maple orange",(.72,.30,.085))]
    needles=[material("Spruce deep",(.10,.26,.19)),
             material("Spruce north face",(.17,.38,.28)),
             material("Spruce tips",(.28,.46,.32))]
    snow=material("Light snow on branches",(.81,.88,.87))
    cyl("Tree trunk",(0,0,1.12),.14,2.24,bark,12)
    if kind==2:
        # Staggered low-poly branch whorls create volume and shadow.
        for level in range(6):
            z=.65+level*.45
            radius=1.07-level*.143
            bpy.ops.mesh.primitive_cone_add(vertices=10,radius1=radius,radius2=0.035,
                depth=1.22,location=(0,0,z+.43))
            obj=bpy.context.object;obj.name="Conifer branch crown"
            obj.data.materials.append(needles[level%3])
            # Subtle snowy needles, only on the most exposed upper tiers.
            if level>=4:
                bpy.ops.mesh.primitive_cone_add(vertices=10,radius1=radius*.63,radius2=.02,
                    depth=.18,location=(0,0,z+.92))
                bpy.context.object.data.materials.append(snow)
        render("tree_pine.png")
    else:
        canopy=leaf_green if kind==0 else leaf_autumn
        for i in range(23):
            angle=i*2.39996
            radial=.29+.72*math.sqrt((i+.5)/23)
            x=math.cos(angle)*radial
            y=math.sin(angle)*radial*.85
            z=2.45+random.random()*.86
            # Uneven canopy is made of overlapping fully lit three-dimensional clumps.
            size=.41+.14*random.random()
            sphere("Leaf canopy",(x,y,z),size,canopy[i%len(canopy)],
                scale=(1.07,.88,.83),sub=2)
        for k in range(7):
            a=k*2.6
            x=math.cos(a)*.75;y=math.sin(a)*.64
            v=Vector((x,y,2.61))-Vector((0,0,1.28))
            obj=cyl("Branch trunk",(.5*x,.5*y,1.28+.5*(2.61-1.28)),.055,v.length,bark,8)
            obj.rotation_euler=v.to_track_quat('Z','Y').to_euler()
        render("tree_green.png" if kind==0 else "tree_autumn.png")

for n in range(4): house(n)
for n in range(3): vehicle(n)
for n in range(3): tree_sprite(n)
print("SPRITES_COMPLETE", OUTPUT, flush=True)
