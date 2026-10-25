"""Open the delivered .blend files in Blender and check their editable contents.
--prepare also sets metric display units and replaces external label fonts with
Blender's built-in font, keeping the projects self contained.
"""
import bpy,sys,argparse,json
from pathlib import Path
from mathutils import Vector
parser=argparse.ArgumentParser();parser.add_argument('--directory',default=str(Path(__file__).resolve().parent/'source'));parser.add_argument('--report');parser.add_argument('--prepare',action='store_true')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
root=Path(args.directory).resolve();reports=[]
for filename in ['municipal-fleet.blend','neighborhood-library.blend','worksite-props.blend']:
    path=root/filename;bpy.ops.wm.open_mainfile(filepath=str(path))
    if args.prepare:
        bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.unit_settings.scale_length=1
        builtin=next((font for font in bpy.data.fonts if font.filepath=='<builtin>'),None)
        probe=None
        if not builtin:
            bpy.ops.object.text_add();probe=bpy.context.object;builtin=probe.data.font
        for obj in bpy.data.objects:
            if obj.type=='FONT' and builtin:obj.data.font=builtin
        if probe:
            data=probe.data;bpy.data.objects.remove(probe,do_unlink=True);bpy.data.curves.remove(data)
        bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True)
    linked=[obj for collection in [bpy.data.objects,bpy.data.meshes,bpy.data.materials,bpy.data.collections] for obj in collection if obj.library]
    assert not linked,filename+' has linked external geometry or materials'
    assert not [im for im in bpy.data.images if im.source=='FILE' and im.users and not im.packed_file],filename+' has unpacked images'
    assert not [font for font in bpy.data.fonts if font.users and font.filepath!='<builtin>' and not font.packed_file],filename+' has unpacked fonts'
    if filename=='municipal-fleet.blend':
        bpy.context.view_layer.update()
        models=[obj for obj in bpy.data.objects if obj.get('Model')]
        assert len(models)==17 and len({obj['Model'] for obj in models})==17
        def ends(obj):
            return [obj.matrix_world@Vector((0,0,z)) for z in [min(v.co.z for v in obj.data.vertices),max(v.co.z for v in obj.data.vertices)]]
        for model in models:
            parts=list(model.children_recursive);assert len(parts)>30,model.name+' has no editable detail'
            arms=[obj for obj in parts if obj.name.startswith('Lift box boom')]
            if arms:assert all(abs(a-b)<.002 for a,b in zip(sorted((ends(obj)[1]-ends(obj)[0]).length for obj in arms),[4.4,4.6])),model.name+' articulated arm lengths changed'
            for obj in parts:
                if obj.name.startswith('Scissor crossed link'):assert abs((ends(obj)[1]-ends(obj)[0]).length-2.17)<.002,'Scissor link stretches'
            booms=[obj for obj in parts if obj.name.startswith('Nested telescopic boom')]
            if booms:
                upper=booms[0].parent;inverse=upper.matrix_world.inverted();tip=max((inverse@point).y for obj in booms for point in ends(obj))
                hook=next(obj for obj in parts if obj.name.startswith('Hook block'))
                assert abs(hook.location.y-tip)<.05,model.name+' hook is detached from the boom tip'
            piston=next((obj for obj in parts if obj.name.startswith('Polished lift piston')),None)
            if piston:
                floor=next(obj for obj in parts if obj.name.startswith('Steel tipper floor'));endpoint=floor.matrix_world.inverted()@ends(piston)[1]
                bounds=[(min(v.co[i] for v in floor.data.vertices),max(v.co[i] for v in floor.data.vertices)) for i in range(3)]
                assert all(low-.1<=endpoint[i]<=high+.1 for i,(low,high) in enumerate(bounds)),model.name+' tipper piston does not connect to the bed'
    elif filename=='neighborhood-library.blend':
        assert len([obj for obj in bpy.data.objects if obj.name.startswith('Courtyard theme') and obj.parent is None])==10
    else:
        assert len([obj for obj in bpy.data.objects if obj.parent is None and (obj.name.startswith('worker-') or obj.name in ['cone','barrier','pump','generator','toolbox','stabilizer','cable-reel'])])==19
    reports.append({'file':filename,'bytes':path.stat().st_size,'objects':len(bpy.data.objects),'meshes':len(bpy.data.meshes),'materials':len(bpy.data.materials),'linkedGeometry':len(linked),'metricUnits':bpy.context.scene.unit_settings.system=='METRIC','externalDependencies':False})
if args.report:Path(args.report).write_text(json.dumps(reports,indent=2))
print('UPRAVDOM_BLENDER_SOURCE_VERIFIED '+json.dumps(reports),flush=True)
