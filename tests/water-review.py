"""Render the ocean and sky shaders with the original coastline buffers on EGL."""
import base64
import ctypes as c
from importlib.util import module_from_spec, spec_from_file_location
import json
from pathlib import Path
import sys

import numpy as np
from PIL import Image

spec=spec_from_file_location("island_gl",Path(__file__).with_name("compile-shaders.py"))
egl=module_from_spec(spec)
spec.loader.exec_module(egl)
GL=egl.gl
U,I,F,P,S=c.c_uint,c.c_int,c.c_float,c.c_void_p,c.c_char_p

pairs={item["name"]:item for item in json.loads(Path(sys.argv[1]).read_text())}
scene=json.loads(Path(sys.argv[2]).read_text())
out=Path(sys.argv[3])
out.mkdir(exist_ok=True)
width,height=896,504
surface=egl.make_surface(width,height)
gen_vao=GL("glGenVertexArrays",None,I,P)
bind_vao=GL("glBindVertexArray",None,U)
gen_buffer=GL("glGenBuffers",None,I,P)
bind_buffer=GL("glBindBuffer",None,U,U)
buffer_data=GL("glBufferData",None,U,c.c_ssize_t,P,U)
attrib=GL("glGetAttribLocation",I,U,S)
enable_attrib=GL("glEnableVertexAttribArray",None,U)
attrib_pointer=GL("glVertexAttribPointer",None,U,I,U,c.c_ubyte,I,P)
loc=GL("glGetUniformLocation",I,U,S)
uniform1=GL("glUniform1f",None,I,F)
uniform3=GL("glUniform3f",None,I,F,F,F)
mat4=GL("glUniformMatrix4fv",None,I,I,c.c_ubyte,P)
use=GL("glUseProgram",None,U)
draw=GL("glDrawElements",None,U,I,U,P)
read=GL("glReadPixels",None,I,I,I,I,U,U,P)
clear=GL("glClear",None,U)
depth_mask=GL("glDepthMask",None,c.c_ubyte)
enable=GL("glEnable",None,U)
enable(0x0B71)
GL("glViewport",None,I,I,I,I)(0,0,width,height)

terrain_ver="""#version 300 es
precision highp float;
in vec3 position;
uniform mat4 projectionMatrix, viewMatrix;
out vec3 point;
void main(){point=position;gl_Position=projectionMatrix*viewMatrix*vec4(position,1.);}"""
terrain_frag="""#version 300 es
precision highp float;
in vec3 point;
out vec4 color;
void main(){
    float wet=1.-smoothstep(.4,1.6,point.y);
    float grain=fract(sin(dot(point.xz,vec2(12.9898,78.233)))*43758.5453);
    vec3 sand=mix(vec3(.76,.69,.54),vec3(.54,.50,.41),wet);
    color=vec4(sand+(grain-.5)*.027,1.);
}"""

def create_buffer(key,data):
    handle=U()
    gen_buffer(1,c.byref(handle))
    bind_buffer(key,handle)
    buffer_data(key,len(data),data,0x88E4)
    return handle

def bind_mesh(name,program):
    vao=U()
    gen_vao(1,c.byref(vao))
    bind_vao(vao)
    positions=base64.b64decode(scene[name]["positions"])
    index=base64.b64decode(scene[name]["index"])
    create_buffer(0x8892,positions)
    position=attrib(program,b"position")
    enable_attrib(position)
    attrib_pointer(position,3,0x1406,0,0,None)
    if name=="sea":
        create_buffer(0x8892,base64.b64decode(scene["offsets"]))
        offset=attrib(program,b"shoreOffset")
        enable_attrib(offset)
        attrib_pointer(offset,1,0x1406,0,0,None)
    create_buffer(0x8893,index)
    return vao,len(index)//4

identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]

def set_camera(program):
    for name,values in zip([b"modelMatrix",b"projectionMatrix",b"viewMatrix"],[identity,scene["camera"]["projection"],scene["camera"]["view"]]):
        mat4(loc(program,name),1,0,(F*16)(*values))
    uniform3(loc(program,b"cameraPosition"),*scene["camera"]["position"])
    uniform1(loc(program,b"toneMappingExposure"),1.0)

sky=egl.link_pair(pairs["sky"]["v"],pairs["sky"]["f"])
ocean=egl.link_pair(pairs["ocean"]["v"],pairs["ocean"]["f"])
terrain=egl.link_pair(terrain_ver,terrain_frag)
materials=[(sky,*bind_mesh("sky",sky)),(terrain,*bind_mesh("terrain",terrain)),(ocean,*bind_mesh("sea",ocean))]
previous=None
frames=int(sys.argv[4]) if len(sys.argv)>4 else 2
for frame in range(frames):
    time=frame*(.77 if frames==2 else 1/24)
    clear(0x4000|0x100)
    for i,(program,vao,count) in enumerate(materials):
        depth_mask(int(i!=0))
        use(program)
        set_camera(program)
        uniform1(loc(program,b"time"),time)
        uniform1(loc(program,b"fidelity"),1.)
        bind_vao(vao)
        draw(0x0004,count,0x1405,None)
    bits=(c.c_ubyte*(width*height*4))()
    read(0,0,width,height,0x1908,0x1401,bits)
    image=np.asarray(bits,dtype=np.uint8).reshape(height,width,4)[::-1,:,:3]
    Image.fromarray(image).save(out/f"sea-{frame:03}.png")
    if previous is None:
        previous=image.copy()
    if frame==frames-1:
        changed=float((np.max(np.abs(image.astype(np.int16)-previous),axis=2)>12).mean())
        print(f"Pixels changed by surface animation: {changed:.1%}")
        assert changed>.05
