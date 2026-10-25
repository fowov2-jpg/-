"""Original Blender assets for Upravdom. Metres, Z up, front +Y."""
import bpy, bmesh, math, random
from mathutils import Vector
_meshes={}

def reset():
    _meshes.clear()
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    for data in list(bpy.data.materials): bpy.data.materials.remove(data)

def material(name, color, metallic=0, roughness=.5, noise=0, emission=0):
    if name in bpy.data.materials:return bpy.data.materials[name]
    mat=bpy.data.materials.new(name);mat.use_nodes=True
    bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Metallic'].default_value=metallic;bs.inputs['Roughness'].default_value=roughness
    bs.inputs['Coat Weight'].default_value=.3 if metallic else .05
    if emission:
        bs.inputs['Emission Color'].default_value=(*color,1);bs.inputs['Emission Strength'].default_value=emission
    if noise:
        tex=mat.node_tree.nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=36
        bump=mat.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=noise;bump.inputs['Distance'].default_value=.015
        mat.node_tree.links.new(tex.outputs['Fac'],bump.inputs['Height']);mat.node_tree.links.new(bump.outputs['Normal'],bs.inputs['Normal'])
    return mat

def finish(obj,name,mat,parent=None,bevel=0):
    obj.name=name
    if mat and not obj.data.materials:obj.data.materials.append(mat)
    if parent:obj.parent=parent
    if bevel:
        for face in obj.data.polygons:face.use_smooth=True
        mod=obj.modifiers.new('Machined edges','BEVEL');mod.width=bevel;mod.segments=3
        mod=obj.modifiers.new('Surface normals','WEIGHTED_NORMAL');mod.keep_sharp=True
    return obj

def empty(name,parent=None):
    obj=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(obj)
    if parent:obj.parent=parent
    return obj

def box(name,loc,size,mat,parent=None,bevel=.025):
    key=('box',tuple(round(v,6) for v in size),mat.name)
    if key not in _meshes:
        data=bpy.data.meshes.new(name)
        x,y,z=[v/2 for v in size]
        data.from_pydata([(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)],[],[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
        data.update();_meshes[key]=data
    obj=bpy.data.objects.new(name,_meshes[key]);bpy.context.collection.objects.link(obj)
    obj.location=loc;return finish(obj,name,mat,parent,bevel)

def cylinder(name,loc,radius,depth,mat,parent=None,axis='Z',vertices=24):
    key=('cylinder',round(radius,6),round(depth,6),vertices,mat.name)
    if key not in _meshes:
        verts=[(radius*math.cos(math.tau*i/vertices),radius*math.sin(math.tau*i/vertices),z) for z in [-depth/2,depth/2] for i in range(vertices)]
        faces=[tuple(range(vertices-1,-1,-1)),tuple(range(vertices,vertices*2))]+[(i,(i+1)%vertices,(i+1)%vertices+vertices,i+vertices) for i in range(vertices)]
        data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update();_meshes[key]=data
    obj=bpy.data.objects.new(name,_meshes[key]);bpy.context.collection.objects.link(obj);obj.location=loc
    if axis=='X':obj.rotation_euler[1]=math.pi/2
    elif axis=='Y':obj.rotation_euler[0]=math.pi/2
    for face in obj.data.polygons:face.use_smooth=len(face.vertices)==4
    return finish(obj,name,mat,parent,min(.025,radius*.12))

def sphere(name,loc,scale,mat,parent=None):
    key=('sphere',mat.name)
    if key not in _meshes:
        data=bpy.data.meshes.new(name);bm=bmesh.new();bmesh.ops.create_uvsphere(bm,u_segments=20,v_segments=12,radius=1);bm.to_mesh(data);bm.free();_meshes[key]=data
    obj=bpy.data.objects.new(name,_meshes[key]);bpy.context.collection.objects.link(obj);obj.location=loc;obj.scale=scale
    for face in obj.data.polygons:face.use_smooth=True
    return finish(obj,name,mat,parent)

def torus(name,loc,major,minor,mat,parent=None,axis='Z'):
    key=('torus',round(major,6),round(minor,6),mat.name)
    if key not in _meshes:
        verts=[((major+minor*math.cos(math.tau*j/8))*math.cos(math.tau*i/32),(major+minor*math.cos(math.tau*j/8))*math.sin(math.tau*i/32),minor*math.sin(math.tau*j/8)) for i in range(32) for j in range(8)]
        faces=[(i*8+j,((i+1)%32)*8+j,((i+1)%32)*8+(j+1)%8,i*8+(j+1)%8) for i in range(32) for j in range(8)]
        data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update();_meshes[key]=data
    obj=bpy.data.objects.new(name,_meshes[key]);bpy.context.collection.objects.link(obj);obj.location=loc
    if axis=='X':obj.rotation_euler[1]=math.pi/2
    for face in obj.data.polygons:face.use_smooth=True
    return finish(obj,name,mat,parent)

def rod(name,a,b,radius,mat,parent=None,vertices=12):
    a,b=Vector(a),Vector(b);obj=cylinder(name,(a+b)/2,radius,(b-a).length,mat,parent,vertices=vertices)
    obj.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return obj

def mesh(name,vertices,faces,mat,parent=None,bevel=0):
    data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update()
    if len(faces)>1:
        bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj)
    return finish(obj,name,mat,parent,bevel)

def quad(name,points,mat,parent=None):return mesh(name,points,[(0,1,2,3)],mat,parent)

def text(name,body,loc,size,mat,parent=None,rotation=(0,0,0)):
    data=bpy.data.curves.new(name,'FONT');data.body=body;data.size=size;data.align_x='CENTER';data.extrude=.001
    for font in bpy.data.fonts:
        if 'DejaVu' in font.name:data.font=font;break
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=loc;obj.rotation_euler=rotation
    return finish(obj,name,mat,parent)

def camera(name,location,target,scale,orthographic=True):
    data=bpy.data.cameras.new(name);obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj)
    obj.location=location;obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    if orthographic:data.type='ORTHO';data.ortho_scale=scale
    else:data.lens=52
    bpy.context.scene.camera=obj;return obj

def studio(samples=32,transparent=True):
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=samples
    scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
    scene.cycles.use_denoising=True;scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_threshold=.035
    scene.render.use_persistent_data=True
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.film_transparent=transparent
    scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.7,.79,.91,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
    data=bpy.data.lights.new('Late afternoon sun','SUN');data.energy=2.8;data.angle=math.radians(9)
    obj=bpy.data.objects.new('Late afternoon sun',data);bpy.context.collection.objects.link(obj)
    obj.rotation_euler=Vector((7,10,-19)).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.lights.new('Sky softbox','AREA');data.energy=500;data.shape='DISK';data.size=10
    obj=bpy.data.objects.new('Sky softbox',data);bpy.context.collection.objects.link(obj);obj.location=(4,-3,10)
    scene.render.resolution_percentage=100
    return scene

def render(path,width,height,samples=None):
    s=bpy.context.scene;s.render.resolution_x=width;s.render.resolution_y=height;s.render.filepath=str(path)
    if samples:s.cycles.samples=samples
    bpy.ops.render.render(write_still=True)

def descendants(root):
    return [root]+[child for obj in [root] for child in obj.children_recursive]

def show(root,visible):
    for obj in descendants(root):obj.hide_render=not visible
