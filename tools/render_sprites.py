"""Generate original transparent isometric game sprites with Blender.
Usage: blender -b -t 2 --python tools/render_sprites.py -- --output web/assets/rendered
No stock meshes, fonts, private references, network services or runtime dependencies.
"""
import bpy, math, os, sys, random
from mathutils import Vector
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
        mod.affect='EDGES' if hasattr(mod,'affect') else None
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
    scene.cycles.use_denoising=True
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
    render(f"house_{idx+1:02d}.png")

def vehicle(i):
    clear();common(6.5,0.77)
    white=material("Clean painted steel",(.83,.89,.91),rough=.3)
    paint=[material("Santechnik red",(.76,.09,.09)),
           material("Electric yellow",(.95,.68,.08)),
           material("Repair blue",(.16,.48,.70))][i]
    body=paint if i==1 else white
    window=material("Van windows",(.10,.23,.31),rough=.09,metallic=.32)
    rubber=material("Tires",(.058,.067,.076),rough=.95)
    lights=material("Headlamps",(.89,.81,.56),glow=.30)
    steel=material("Alloy",(.53,.58,.60),metallic=.65)
    # Chassis and rounded body.
    box("Box van cargo",(0,.10,.98),(2.65,1.22,1.40),body,.12)
    box("Driver cabin",(1.07,.08,.85),(.92,1.26,1.10),white,.18)
    box("Windscreen",(1.58,.08,1.12),(.04,1.00,.48),window)
    box("Cabin windows",(1.13,-.572,1.20),(.51,.04,.36),window)
    box("Cargo stripe",(0,-.537,.79),(2.55,.035,.20),paint)
    box("Cargo stripe other side",(0,.735,.79),(2.55,.035,.20),paint)
    box("Cabin roof",(1.0,.08,1.55),(.97,1.13,.08),white,.08)
    for x in [-.97,1.02]:
        for y in [-.66,.65]:
            cyl("Rubber wheel",(x,y,.33),.32,.16,rubber,24,rotate=(radians(90),0,0))
            cyl("Wheel hub",(x,y*1.12,.33),.14,.07,steel,24,rotate=(radians(90),0,0))
    for y in [-.37,.37]:
        box("Headlights",(1.56,y,.57),(.05,.21,.14),lights)
    box("Roof beacon",(1.09,0,1.63),(.35,.17,.085),paint,.02)
    box("Front bumper",(1.64,0,.48),(.19,1.25,.12),steel)
    render(["van_water.png","van_electric.png","van_repair.png"][i])

for n in range(4): house(n)
for n in range(3): vehicle(n)
print("SPRITES_COMPLETE", OUTPUT, flush=True)
