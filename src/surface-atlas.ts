import * as T from 'three'
import { albedoAsset, normalAsset } from './assets/material-atlas.ts'

function atlas(asset:string,srgb:boolean){
  const texture=new T.Texture()
  texture.flipY=false
  texture.colorSpace=srgb?T.SRGBColorSpace:T.NoColorSpace
  texture.magFilter=T.LinearFilter
  texture.minFilter=T.LinearMipmapLinearFilter
  texture.anisotropy=4
  if(typeof Image!=='undefined'){
    const image=new Image()
    image.onload=()=>{texture.image=image;texture.needsUpdate=true}
    image.src=asset
  }
  return texture
}
export const surfaceAlbedo={value:atlas(albedoAsset,true)}
export const surfaceNormals={value:atlas(normalAsset,false)}

export const atlasGLSL=`
uniform sampler2D surfaceAlbedo;
uniform sampler2D surfaceNormals;
vec4 sampleTile(sampler2D textureMap,vec2 uv,vec2 cell){
  vec2 cellSize=vec2(.25,.5), usable=cellSize*.953125;
  vec2 local=fract(vec2(uv.x,-uv.y))*.953125+.0234375;
  vec2 coord=(cell+local)*cellSize;
  vec2 mapped=vec2(uv.x,-uv.y)*usable;
  return textureGrad(textureMap,coord,dFdx(mapped),dFdy(mapped));
}
vec3 triplanar(sampler2D tex,vec3 p,vec2 cell){
  vec3 crossVector=cross(dFdx(p),dFdy(p));
  vec3 ab=abs(crossVector)/max(length(crossVector),.00001);
  vec3 axis=pow(ab+vec3(.001),vec3(6.));
  axis/=dot(axis,vec3(1.));
  return axis.x*sampleTile(tex,p.zy,cell).rgb+axis.y*sampleTile(tex,p.xz,cell).rgb+axis.z*sampleTile(tex,p.xy,cell).rgb;
}
vec3 surfaceNormal(vec3 n,vec3 eye,vec2 uv,vec3 mapN,float power){
  vec3 q0=dFdx(eye),q1=dFdy(eye);
  vec2 st0=dFdx(uv),st1=dFdy(uv);
  vec3 t=cross(q1,n)*st0.x+cross(n,q0)*st1.x;
  vec3 b=cross(q1,n)*st0.y+cross(n,q0)*st1.y;
  float scale=inversesqrt(max(max(dot(t,t),dot(b,b)),.00000001));
  return normalize(n*max(.65,mapN.z)+power*scale*(t*mapN.x+b*mapN.y));
}
`
