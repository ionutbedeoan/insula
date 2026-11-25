"""Pack the reduced, centered meshes and textures into the offline game's assets."""
from pathlib import Path
from PIL import Image
import base64
import io
import json
import sys
import numpy as np

folder = Path(sys.argv[1])
keys = {'stump': 'tree_stump_01', 'log': 'dead_tree_trunk_02', 'rock': 'boulder_01'}

def data(array, dtype):
    return base64.b64encode(np.ascontiguousarray(array, dtype=dtype).tobytes()).decode()

def texture(source, size, quality):
    image = Image.open(source).convert('RGB').resize((size, size), Image.Resampling.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, 'WEBP', quality=quality, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(buffer.getvalue()).decode()

packed = {}
for key, name in keys.items():
    doc = json.loads((folder / (name + '-game.gltf')).read_text())
    blob = (folder / doc['buffers'][0]['uri']).read_bytes()
    source = doc['meshes'][0]['primitives'][0]
    def reader(index):
        info = doc['accessors'][index]
        view = doc['bufferViews'][info['bufferView']]
        dtype = {5126: '<f4', 5123: '<u2', 5125: '<u4'}[info['componentType']]
        dim = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[info['type']]
        start = view.get('byteOffset', 0) + info.get('byteOffset', 0)
        return np.frombuffer(blob, dtype=dtype, count=info['count'] * dim, offset=start).reshape((-1, dim))
    position = reader(source['attributes']['POSITION'])
    lower, upper = position.min(axis=0), position.max(axis=0)
    position = (position - (lower + upper) * .5) / (upper - lower)
    normals = reader(source['attributes']['NORMAL']) * (upper - lower)
    normals /= np.linalg.norm(normals, axis=1, keepdims=True)
    uv = reader(source['attributes']['TEXCOORD_0'])
    index = reader(source['indices']).flatten()
    assert index.max() < 65536 and len(index) % 3 == 0
    paths = folder / name / 'textures'
    packed[key] = {
        'p': data(position, '<f4'), 'n': data(normals, '<f4'), 'u': data(uv, '<f4'), 'i': data(index, '<u2'),
        'diffuse': texture(paths / (name + '_diff_1k.jpg'), 768, 86),
        'normal': texture(paths / (name + '_nor_gl_1k.jpg'), 512, 83)
    }
    print(key, 'triangles', len(index)//3, 'vertices', len(position), 'extents', upper-lower)
out = Path(__file__).resolve().parents[1]/'src/assets/opening-scans.ts'
out.write_text('export const openingScans='+json.dumps(packed, separators=(',', ':'))+'\n')
