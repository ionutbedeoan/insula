"""Compile game materials against a headless OpenGL ES 3 driver on Linux."""
import ctypes as c
import json
import sys

egl=c.CDLL("libEGL.so.1")
pointer=c.c_void_p
integer=c.c_int
unsigned=c.c_uint

def egl_fn(name,out,*args):
    fn=getattr(egl,name)
    fn.restype,fn.argtypes=out,list(args)
    return fn

display=egl_fn("eglGetPlatformDisplay",pointer,unsigned,pointer,pointer)(0x31DD,None,None)
assert egl_fn("eglInitialize",unsigned,pointer,pointer,pointer)(display,None,None)
assert egl_fn("eglBindAPI",unsigned,unsigned)(0x30A0)
attrs=(integer*9)(0x3033,1,0x3040,64,0x3024,8,0x3025,16,0x3038)
config=pointer()
count=integer()
assert egl_fn("eglChooseConfig",unsigned,pointer,pointer,pointer,integer,pointer)(display,attrs,c.byref(config),1,c.byref(count)) and count.value
context=egl_fn("eglCreateContext",pointer,pointer,pointer,pointer,pointer)(display,config,None,(integer*3)(0x3098,3,0x3038))
assert context
def make_surface(width,height):
    surface=egl_fn("eglCreatePbufferSurface",pointer,pointer,pointer,pointer)(display,config,(integer*5)(0x3057,width,0x3056,height,0x3038))
    assert surface
    assert egl_fn("eglMakeCurrent",unsigned,pointer,pointer,pointer,pointer)(display,surface,surface,context)
    return surface

make_surface(16,16)
lookup=egl_fn("eglGetProcAddress",pointer,c.c_char_p)

def gl(name,out,*args):
    return c.CFUNCTYPE(out,*args)(lookup(name.encode()))

create_shader=gl("glCreateShader",unsigned,unsigned)
shader_source=gl("glShaderSource",None,unsigned,integer,pointer,pointer)
compile_shader=gl("glCompileShader",None,unsigned)
shader_status=gl("glGetShaderiv",None,unsigned,unsigned,pointer)
shader_log=gl("glGetShaderInfoLog",None,unsigned,integer,pointer,pointer)
create_program=gl("glCreateProgram",unsigned)
attach=gl("glAttachShader",None,unsigned,unsigned)
link=gl("glLinkProgram",None,unsigned)
program_status=gl("glGetProgramiv",None,unsigned,unsigned,pointer)
program_log=gl("glGetProgramInfoLog",None,unsigned,integer,pointer,pointer)
renderer=gl("glGetString",c.c_char_p,unsigned)(0x1F01).decode()
print(renderer)

def compile_one(source,stage):
    shader=create_shader(stage)
    src=(c.c_char_p*1)(source.encode())
    shader_source(shader,1,src,None)
    compile_shader(shader)
    result=integer()
    shader_status(shader,0x8B81,c.byref(result))
    if not result.value:
        log=c.create_string_buffer(12048)
        shader_log(shader,len(log),None,log)
        print(log.value.decode())
        for i,line in enumerate(source.splitlines(),start=1):
            if "terrain" in line or "gl_Position" in line:
                print(f"{i}: {line}")
        raise RuntimeError("Shader compile failed")
    return shader

def link_pair(vertex,fragment):
    program=create_program()
    attach(program,compile_one(vertex,0x8B31))
    attach(program,compile_one(fragment,0x8B30))
    link(program)
    status=integer()
    program_status(program,0x8B82,c.byref(status))
    if not status.value:
        log=c.create_string_buffer(12048)
        program_log(program,len(log),None,log)
        raise RuntimeError(log.value.decode())
    return program

if __name__=="__main__":
    with open(sys.argv[1],encoding="utf-8") as file:
        pairs=json.load(file)
    for pair in pairs:
        print(pair["name"],flush=True)
        link_pair(pair["v"],pair["f"])
    print(f"{len(pairs)} shader pairs compiled and linked.")
