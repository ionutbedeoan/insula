"""Reduce the sourced glTF meshes while preserving their UV unwrap."""
from pathlib import Path
import sys
import bpy

folder = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
targets = {'tree_stump_01': 3900, 'dead_tree_trunk_02': 4200, 'boulder_01': 5900}
for name, count in targets.items():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    source = folder / name / (name + '.gltf')
    bpy.ops.import_scene.gltf(filepath=str(source))
    obj = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=.000055)
    bpy.ops.object.mode_set(mode='OBJECT')
    modifier = obj.modifiers.new('Game resolution', 'DECIMATE')
    obj.data.calc_loop_triangles()
    modifier.ratio = min(1.0, count / len(obj.data.loop_triangles))
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.materials.clear()
    path = folder / (name + '-game.gltf')
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLTF_SEPARATE', export_materials='NONE', export_yup=True)
