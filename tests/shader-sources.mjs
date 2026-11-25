import * as T from 'three'
import { writeFile } from 'node:fs/promises'
import { canopyDepth, canopyMaterial } from '../src/canopy-material.ts'
import { islandMaterial } from '../src/island-materials.ts'
import { LivingWorld } from '../src/living-world.tsx'
import { Sky, Ocean, Waterfall } from '../src/water.tsx'
import { createElement } from 'react'
import { create } from '@react-three/test-renderer'

Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true,self:{requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{}}})
const renderer=await create(createElement('group',null,createElement(Sky),createElement(Ocean),createElement(Waterfall),createElement(LivingWorld,{low:true})))
const pairs=[]
const std=T.ShaderLib.standard
for(const style of ['ground','architecture','wood','foliage','stone','fabric']){
  for(const instanced of ['ground','architecture','fabric'].includes(style)?[false]:[false,true]){
    const material=islandMaterial(style,{vertexColors:style!=='fabric',wind:style==='foliage'?.118:0})
    const shader={vertexShader:std.vertexShader,fragmentShader:std.fragmentShader,uniforms:{}}
    material.onBeforeCompile(shader)
    pairs.push({name:style+(instanced?'-instanced':''),v:shader.vertexShader,f:shader.fragmentShader,instanced,vertexColors:style!=='fabric',standard:true})
  }
}
{
  const material=islandMaterial('ground',{vertexColors:true,economy:true})
  const shader={vertexShader:std.vertexShader,fragmentShader:std.fragmentShader,uniforms:{}}
  material.onBeforeCompile(shader)
  pairs.push({name:'ground-economy',v:shader.vertexShader,f:shader.fragmentShader,vertexColors:true,standard:true})
}
for(const [name,material,lib] of [['canopy-instanced',canopyMaterial,std],['canopy-depth',canopyDepth,T.ShaderLib.depth]]){
  const shader={vertexShader:lib.vertexShader,fragmentShader:lib.fragmentShader,uniforms:{}}
  material.onBeforeCompile(shader)
  pairs.push({name,v:shader.vertexShader,f:shader.fragmentShader,instanced:true,vertexColors:name!=='canopy-depth',map:true,standard:true})
}
const custom=[]
renderer.scene.instance.traverse(node=>{
  if(!node.material?.isShaderMaterial)return
  const {vertexShader:v,fragmentShader:f}=node.material
  if(!custom.some(pair=>pair.v===v&&pair.f===f)){
    custom.push({name:['sky','ocean','waterfall-and-pool','waterfall-mist','butterfly-wings'][custom.length],v,f,instanced:node.isInstancedMesh})
  }
})
await renderer.unmount()
function expand(source){
  return source.replace(/#include <([\w_]+)>/g,(_,name)=>{
    if(!(name in T.ShaderChunk))throw Error('Missing Three.js shader chunk '+name)
    return expand(T.ShaderChunk[name])
  })
}
const shadowVariants=pairs.filter(pair=>['ground','architecture','wood-instanced','foliage-instanced','stone-instanced','fabric'].includes(pair.name)).map(pair=>({...pair,shadow:true,name:pair.name+'-pcf'}))
function expandForMaterial(source,lights){
  const result=expand(source).replace(/\b(?:NUM_[A-Z_]+|UNION_CLIPPING_PLANES)\b/g, name=>String(lights[name]??0))
  const loops=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g
  return result.replace(loops,(_,start,end,body)=>{
    let code=''
    for(let i=Number(start);i<Number(end);i++)code+=body.replace(/\[\s*i\s*\]/g,'['+i+']').replace(/UNROLLED_LOOP_INDEX/g,String(i))
    return code
  })
}
function prepare(pair){
  const lights={NUM_DIR_LIGHTS:1,NUM_POINT_LIGHTS:pair.shadow?3:0,NUM_HEMI_LIGHTS:1,NUM_DIR_LIGHT_SHADOWS:pair.shadow?1:0}
  const flags=`
#define HIGH_PRECISION
#define SHADER_TYPE MeshStandardMaterial
#define SHADER_NAME Island
#define DEPTH_PACKING 0
#define USE_FOG
#define TONE_MAPPING
${pair.shadow?'#define USE_SHADOWMAP\n#define SHADOWMAP_TYPE_PCF':''}
${pair.instanced?'#define USE_INSTANCING\n#define USE_INSTANCING_COLOR':''}
${pair.vertexColors?'#define USE_COLOR':''}
${pair.map?'#define USE_MAP\n#define MAP_UV uv\n#define USE_ALPHATEST':''}
`
  const globals=`uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;
uniform vec3 cameraPosition;
uniform bool isOrthographic;`
  const attributes=`
in vec3 position;
in vec3 normal;
in vec2 uv;
${pair.vertexColors?'in vec3 color;':''}
${pair.instanced?'in mat4 instanceMatrix; in vec3 instanceColor;':''}
`
  const colors=T.ShaderChunk.colorspace_pars_fragment+'\n'+T.ShaderChunk.tonemapping_pars_fragment+'\nvec3 toneMapping(vec3 color){return ACESFilmicToneMapping(color);}'+'\nvec4 linearToOutputTexel(vec4 x){return sRGBTransferOETF(x);}'
  return {
    name:pair.name,
    v:'#version 300 es\n#define attribute in\n#define varying out\nprecision highp float; precision highp int;\n'+flags+globals+attributes+expandForMaterial(pair.v,lights),
    f:'#version 300 es\n#define varying in\n#define gl_FragColor pc_fragColor\n#define texture2D texture\nprecision highp float; precision highp int;\nout vec4 pc_fragColor;\n'+flags+globals+'\n'+colors+'\n'+expandForMaterial(pair.f,lights)
  }
}
await writeFile(process.argv[2]??'shader-sources.json',JSON.stringify([...pairs,...shadowVariants,...custom].map(prepare)))
