"""Review the exported game geometry using Blender/Cycles, without WebGL."""
import array
import base64
import json
import math
import pathlib
import sys

import bpy
from mathutils import Matrix, Vector

folder = pathlib.Path(sys.argv[sys.argv.index("--") + 1]).resolve()
doc = json.loads((folder / 'models.json').read_text())
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
conversion=Matrix(((1,0,0,0),(0,0,1,0),(0,1,0,0),(0,0,0,1)))

def buffer(data, code):
    v=array.array(code)
    v.frombytes(base64.b64decode(data))
    return v

def swatch(name,color,roughness=.78,metallic=0.):
    m=bpy.data.materials.new(name)
    m.use_nodes=True
    shader=m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value=(*color,1)
    shader.inputs['Roughness'].default_value=roughness
    shader.inputs['Metallic'].default_value=metallic
    return m

def attrib_material():
    mat=swatch('Game vertex colours',(1,1,1))
    tree=mat.node_tree
    attr=tree.nodes.new('ShaderNodeVertexColor')
    attr.layer_name='Colour'
    info=tree.nodes.new('ShaderNodeObjectInfo')
    mix=tree.nodes.new('ShaderNodeMixRGB')
    mix.blend_type='MULTIPLY'
    mix.inputs[0].default_value=1
    tree.links.new(attr.outputs['Color'],mix.inputs[1])
    tree.links.new(info.outputs['Color'],mix.inputs[2])
    tree.links.new(mix.outputs[0],tree.nodes.get('Principled BSDF').inputs['Base Color'])
    return mat

texture_paths={
    "ground":"forest_floor-diff.jpg",
    "stone":"rock_boulder_dry-diff.jpg",
    "architecture":"weathered_planks-diff.jpg",
    "wood":"palm_bark-diff.jpg",
}
def apply_scan(mat, style):
    source=folder / texture_paths[style]
    if not source.exists(): return
    nodes=mat.node_tree.nodes
    links=mat.node_tree.links
    shader=nodes.get('Principled BSDF')
    prior=shader.inputs['Base Color'].links[0].from_socket
    coord=nodes.new('ShaderNodeTexCoord')
    frequency=nodes.new('ShaderNodeVectorMath')
    frequency.operation='SCALE'
    frequency.inputs['Scale'].default_value=.63 if style=='ground' else .62
    links.new(coord.outputs['Object'],frequency.inputs[0])
    scan=nodes.new('ShaderNodeTexImage')
    scan.image=bpy.data.images.load(str(source),check_existing=True)
    scan.projection='BOX'
    scan.projection_blend=.24
    links.new(frequency.outputs['Vector'],scan.inputs['Vector'])
    convert=nodes.new('ShaderNodeMixRGB')
    convert.blend_type='MULTIPLY'
    convert.inputs[0].default_value=1
    convert.inputs[2].default_value=(2.9,2.9,2.9,1)
    links.new(scan.outputs['Color'],convert.inputs[1])
    blend=nodes.new('ShaderNodeMixRGB')
    blend.blend_type='MULTIPLY'
    blend.inputs[0].default_value=.71
    links.new(prior,blend.inputs[1])
    links.new(convert.outputs[0],blend.inputs[2])
    links.new(blend.outputs[0],shader.inputs['Base Color'])
    normal_source=pathlib.Path(str(source).replace('-diff','-nor_gl'))
    if normal_source.exists():
        n=nodes.new('ShaderNodeTexImage')
        n.image=bpy.data.images.load(str(normal_source),check_existing=True)
        n.image.colorspace_settings.name='Non-Color'
        n.projection='BOX'
        n.projection_blend=.24
        links.new(frequency.outputs['Vector'],n.inputs['Vector'])
        relief=nodes.new('ShaderNodeBump')
        relief.inputs['Strength'].default_value=.14
        relief.inputs['Distance'].default_value=.024
        links.new(n.outputs['Color'],relief.inputs['Height'])
        links.new(relief.outputs['Normal'],shader.inputs['Normal'])
materials={}
for style in ["plain",*texture_paths]:
    materials[style]=attrib_material()
    if style in texture_paths: apply_scan(materials[style],style)
styles={}
for obj in doc['objects']:
    if obj.get('s'): styles[obj['mesh']]=obj['s']

def scanned_leaves(name,filename):
    mat=swatch(name,(.42,.56,.30))
    path=folder/filename
    if not path.exists():return mat
    tree=mat.node_tree
    tex=tree.nodes.new("ShaderNodeTexImage")
    tex.image=bpy.data.images.load(str(path),check_existing=True)
    shader=tree.nodes.get('Principled BSDF')
    tree.links.new(tex.outputs["Color"],shader.inputs["Base Color"])
    tree.links.new(tex.outputs["Alpha"],shader.inputs["Alpha"])
    return mat
fern=scanned_leaves("CC0 fern","fern-02.webp")
canopy=scanned_leaves("Tree foliage","canopy.webp")
def scan_prop(name):
    mat=swatch(name,(.63,.57,.44))
    source=folder/(name+'.webp')
    if not source.exists():return mat
    tree=mat.node_tree
    shader=tree.nodes.get('Principled BSDF')
    albedo=tree.nodes.new('ShaderNodeTexImage')
    albedo.image=bpy.data.images.load(str(source),check_existing=True)
    tree.links.new(albedo.outputs['Color'],shader.inputs['Base Color'])
    source_normal=folder/(name+'-nor.webp')
    if source_normal.exists():
        image=tree.nodes.new('ShaderNodeTexImage')
        image.image=bpy.data.images.load(str(source_normal),check_existing=True)
        image.image.colorspace_settings.name='Non-Color'
        normal=tree.nodes.new('ShaderNodeNormalMap')
        normal.inputs['Strength'].default_value=.83
        tree.links.new(image.outputs['Color'],normal.inputs['Color'])
        tree.links.new(normal.outputs['Normal'],shader.inputs['Normal'])
    return mat
cutout_styles={'fern-scan':fern,'canopy':canopy}
for label in ['stump','rock','log']:cutout_styles['opening-'+label]=scan_prop('opening-'+label)
material_ids={}
meshes=[]
for index, data in enumerate(doc['meshes']):
    coords=buffer(data['v'],'f')
    indices=buffer(data['i'],'I') if data['i'] else range(len(coords)//3)
    vertices=list(zip(coords[0::3],coords[2::3],coords[1::3]))
    faces=[(indices[i],indices[i+2],indices[i+1]) for i in range(0,len(indices),3)]
    mesh=bpy.data.meshes.new('Game mesh '+str(index))
    mesh.from_pydata(vertices,[],faces)
    for polygon in mesh.polygons:
        polygon.use_smooth=data['i'] is not None or len(vertices)<1400
    if data['c']:
        colors=buffer(data['c'],'f')
        values=array.array('f')
        for i in range(0,len(colors),3):
            values.extend((colors[i],colors[i+1],colors[i+2],1))
        mesh.color_attributes.new(name='Colour',type='FLOAT_COLOR',domain='POINT').data.foreach_set('color',values)
        mesh.materials.append(materials.get(styles.get(index),materials["plain"]))
    if data.get("u"):
        uv=buffer(data["u"],"f")
        coords=array.array('f')
        for loop in mesh.loops:
            i=loop.vertex_index*2
            coords.extend((uv[i],1-uv[i+1]))
        mesh.uv_layers.new(name="Fern UV").data.foreach_set("uv",coords)
        mesh.materials.clear()
        mesh.materials.append(cutout_styles[styles.get(index)])
    meshes.append(mesh)
def add_object(mesh,name,render_color,v_matrix,instanced=False):
    obj=bpy.data.objects.new(name,mesh)
    scene.collection.objects.link(obj)
    obj.matrix_world=v_matrix
    obj.color=(*render_color,1)
    if not mesh.color_attributes and not mesh.uv_layers:
        mat_key=tuple(round(value,4) for value in render_color)
        if mat_key not in material_ids:
            material_ids[mat_key]=swatch(str(mat_key),mat_key)
        if not mesh.materials:
            mesh.materials.append(material_ids[mat_key])
        slot=obj.material_slots[0]
        slot.link='OBJECT'
        slot.material=material_ids[mat_key]
    return obj
for data in doc['objects']:
    if data['p']:
        x,z=data['m'][12],data['m'][14]
        if all(math.hypot(x-view['x'],z-view['z'])>138 for view in doc['views']):continue
    mat=Matrix([data['m'][j:j+4] for j in range(0,16,4)]).transposed()
    add_object(meshes[data['mesh']],'Game geometry',data['c'],conversion @ mat @ conversion,data['p'])

def apply_material(obj,material):
    obj.data.materials.append(material)
    return obj

def set_target(obj,target):
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()

ocean=swatch('Ocean review approximation',(.025,.18,.17),.19,.38)
p=ocean.node_tree.nodes.get('Principled BSDF')
p.inputs['Coat Weight'].default_value=.48
w=ocean.node_tree.nodes.new('ShaderNodeTexNoise')
w.inputs['Scale'].default_value=2.9
w.inputs['Detail'].default_value=2
bump=ocean.node_tree.nodes.new('ShaderNodeBump')
bump.inputs['Strength'].default_value=.33
bump.inputs['Distance'].default_value=.11
tex=ocean.node_tree.nodes.new('ShaderNodeTexCoord')
ocean.node_tree.links.new(tex.outputs['Object'],w.inputs['Vector'])
ocean.node_tree.links.new(w.outputs['Fac'],bump.inputs['Height'])
ocean.node_tree.links.new(bump.outputs['Normal'],p.inputs['Normal'])
bpy.ops.mesh.primitive_plane_add(size=1430,location=(0,0,.43))
apply_material(bpy.context.object,ocean)
bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=10,radius=1,location=(-108,-66.75,16.105))
obj=bpy.context.object
obj.scale=(7.95,6.8,.027)
apply_material(obj,ocean)
water=swatch('Cascade review approximation',(.55,.63,.59),.26,.05)
tree=water.node_tree
p=tree.nodes.get('Principled BSDF')
p.inputs['Emission Color'].default_value=(.125,.17,.15,1)
p.inputs['Emission Strength'].default_value=.5
for x,y,z,w,h in [(-110.2,21.5,-73.24,4.55,10.8),(-106.37,20.64,-73.5,2.82,9.10),(-113.79,19.42,-73.05,1.38,6.58)]:
    vertices=[]
    faces=[]
    for j in range(17):
        for i in range(23):
            u,v=i/22,j/16
            vertices.append((x+(u-.5)*w*(1+.38*(1-v)**3),z+(1-v)**4*1.95+.12*math.sin(u*32),y+(v-.5)*h))
            if i<22 and j<16:
                a=j*23+i
                faces.append((a,a+1,a+24,a+23))
    mesh=bpy.data.meshes.new('Cascade silhouette')
    mesh.from_pydata(vertices,[],faces)
    obj=bpy.data.objects.new('Cascade review',mesh)
    scene.collection.objects.link(obj)
    apply_material(obj,water)
    for polygon in mesh.polygons:polygon.use_smooth=True
world=scene.world
world.use_nodes=True
nodes=world.node_tree.nodes
bg=nodes.get('Background')
sky=nodes.new('ShaderNodeTexSky')
sky.sky_type='NISHITA'
sky.sun_elevation=.66
sky.sun_rotation=3.92
sky.air_density=1.19
sky.dust_density=.78
sky.sun_disc=False
world.node_tree.links.new(sky.outputs['Color'],bg.inputs[0])
bg.inputs['Strength'].default_value=.29

def light(name,kind,energy,color,location):
    data=bpy.data.lights.new(name,kind)
    data.energy=energy
    data.color=color
    obj=bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    obj.location=location
    return obj

sun=light('Game light direction','SUN',2.45,(1,.882,.70),(-66,-69,82))
sun.data.angle=.036
set_target(sun,(0,0,0))
for x,y,z in [(163.5,10.9,38),(171.3,10.75,38.7),(174.9,9.12,39)]:
    lamp=light('Archive lamp','POINT',72,(1,.77,.48),(x,z,y))
    lamp.data.shadow_soft_size=.55
camera=bpy.data.objects.new('Review camera',bpy.data.cameras.new('Review camera'))
scene.collection.objects.link(camera)
scene.camera=camera
camera.data.lens=27
camera.data.clip_start=.11
camera.data.clip_end=1200
scene.render.engine='CYCLES'
scene.cycles.device='CPU'
scene.cycles.samples=30
scene.cycles.use_denoising=False
scene.cycles.max_bounces=4
scene.cycles.diffuse_bounces=2
scene.cycles.glossy_bounces=2
scene.render.threads_mode='FIXED'
scene.render.threads=6
scene.render.resolution_x=960
scene.render.resolution_y=600
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='JPEG'
scene.render.image_settings.quality=89
scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast'
scene.view_settings.exposure=.62
for view in doc['views']:
    camera.location=(view['x'],view['z'],view['y'])
    camera.data.lens=view.get('lens',27)
    camera.data.clip_start=view.get('near',.11)
    x,y,z=view['look']
    set_target(camera,(x,z,y))
    scene.render.filepath=str(folder/(view['id']+'.jpg'))
    bpy.ops.render.render(write_still=True)
