import * as T from 'three'
import { canopyPixels } from './assets/canopy.ts'
import { islandTime } from './island-materials.ts'

const texture=new T.Texture()
texture.flipY=false
texture.colorSpace=T.SRGBColorSpace
texture.anisotropy=4
if(typeof Image!=='undefined'){
  const bitmap=new Image()
  bitmap.onload=()=>{texture.image=bitmap;texture.needsUpdate=true}
  bitmap.src=canopyPixels
}

const wind=(shader:T.WebGLProgramParametersWithUniforms)=>{
  shader.uniforms.islandTime=islandTime
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float islandTime;')
    .replace('#include <begin_vertex>',`#include <begin_vertex>
#ifdef USE_INSTANCING
float gust=sin(islandTime*1.04+instanceMatrix[3].x*.16+instanceMatrix[3].z*.095);
float flutter=sin(islandTime*2.2+position.y*1.5+position.x*.73);
transformed.x+=(gust+flutter*.29)*clamp(position.y*.013,0.,.13);
transformed.z+=gust*clamp(position.y*.006,0.,.064);
#endif`)
}

export const canopyMaterial=new T.MeshStandardMaterial({
  map:texture,vertexColors:true,side:T.DoubleSide,alphaTest:.31,roughness:.81,
})
canopyMaterial.name='canopy'
canopyMaterial.onBeforeCompile=shader=>{
  wind(shader)
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',
    '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=diffuseColor.rgb*vec3(.15,.19,.10);')
}

export const canopyDepth=new T.MeshDepthMaterial({
  map:texture,side:T.DoubleSide,alphaTest:.31,depthPacking:T.RGBADepthPacking,
})
canopyDepth.onBeforeCompile=wind
