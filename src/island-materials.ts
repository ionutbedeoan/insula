import * as T from 'three'
import { seaWavesGLSL, shoreFoamGLSL } from './water-surface.ts'
import { atlasGLSL, surfaceAlbedo, surfaceNormals } from './surface-atlas.ts'

export const noiseGLSL=`
float terrainHash(vec2 p) {
  vec3 q=fract(vec3(p.xyx)*.1031);
  q+=dot(q,q.yzx+33.33);
  return fract((q.x+q.y)*q.z);
}
float terrainNoise(vec2 p){
  vec2 i=floor(p),f=fract(p);
  vec2 k=f*f*(3.-2.*f);
  return mix(mix(terrainHash(i),terrainHash(i+vec2(1.,0.)),k.x),
             mix(terrainHash(i+vec2(0.,1.)),terrainHash(i+1.),k.x),k.y);
}
float terrainFbm(vec2 p){
  mat2 turn=mat2(.8,-.6,.6,.8);
  return terrainNoise(p)*.54+terrainNoise(turn*p*2.11)*.30+terrainNoise(turn*p*4.6)*.16;
}
`
type Style='ground'|'architecture'|'wood'|'foliage'|'stone'|'fabric'

const surfaceSnippets:Record<Style,string>={
  ground:`
    vec2 p=islandPosition.xz;
    float wetBiome=clamp(islandWeights.x,0.,1.);
    float lavaBiome=clamp(islandWeights.y,0.,1.);
    float sandy=clamp(islandWeights.z,0.,1.);
    vec2 soilCoordinates=p*.63+vec2(.47,.65)*terrainNoise(p*.081);
    vec3 litter=sampleTile(surfaceAlbedo,soilCoordinates,vec2(0.,0.)).rgb;
    vec3 rockDetail=sampleTile(surfaceAlbedo,p*.62,vec2(2.,0.)).rgb;
    vec3 sandDetail=sampleTile(surfaceAlbedo,p*.53,vec2(1.,1.)).rgb;
    vec3 mossGround=sampleTile(surfaceAlbedo,p*.91,vec2(1.,0.)).rgb;
    float mossBed=wetBiome*smoothstep(.34,.71,terrainFbm(p*.40))*.65;
    vec3 terrainDetail=mix(mix(litter*3.15,mossGround*2.9,mossBed),rockDetail*2.65,lavaBiome*.88);
    terrainDetail=mix(terrainDetail,sandDetail*2.9,sandy*.88);
    diffuseColor.rgb*=mix(vec3(.76),terrainDetail,.74);
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.79,.99,.66),wetBiome*.35);

    float n=terrainFbm(p*.65);
    float micro=terrainNoise(p*14.5);
    float gravel=pow(terrainNoise(p*9.6),6.);
    float leafLitter=pow(terrainFbm(p*4.+terrainNoise(p*.3)),4.);
    diffuseColor.rgb*=.82+n*.29+micro*.09;
    diffuseColor.rgb+=vec3(.111,.087,.041)*gravel*2.1;
    diffuseColor.rgb-=vec3(.14,.12,.052)*leafLitter;
    vec2 wave=p*vec2(.71,3.8);
    float ripple=sin(wave.y+sin(wave.x)*1.65+terrainNoise(p*2.)*1.7);
    float sandTint=smoothstep(-.01,.08,diffuseColor.r-diffuseColor.g);
    float damp=1.-smoothstep(.44,1.43,islandPosition.y+(n-.5)*.29);
    if(islandPosition.y<1.8){
      float oceanEdge=coastDistance(p);
      float latest=sin(shoreWavePhase(p,oceanEdge,islandTime-.69));
      float recentlyWashed=(1.-smoothstep(.55,1.22,islandPosition.y-latest*.22-n*.19))*smoothstep(-5.,-1.,oceanEdge);
      damp=max(damp*.72,recentlyWashed);
    }
    diffuseColor.rgb+=ripple*.014*sandTint;
    diffuseColor.rgb*=mix(vec3(1.),vec3(.53,.59,.60),damp*sandTint*.94);
    float runoff=terrainFbm(p*vec2(.47,1.82)+vec2(n*.3,.17));
    float leafPockets=smoothstep(.51,.76,runoff)*wetBiome*(1.-sandy);
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.76,.73,.51),leafPockets*.72);
    float freckles=smoothstep(.58,.79,terrainFbm(p*vec2(1.9,2.44)));
    diffuseColor.rgb*=.94+freckles*.15;
    float tinyShell=pow(terrainNoise(p*22.1),12.)*smoothstep(.39,.77,terrainNoise(p*1.3));
    diffuseColor.rgb+=vec3(.17,.14,.105)*tinyShell*sandy;
  `,
  architecture:`
    vec3 p=islandPosition;
    vec3 scan=triplanar(surfaceAlbedo,p*.42,vec2(3.,0.));
    diffuseColor.rgb*=mix(vec3(.74),scan*3.2,.71);
    float grain=terrainFbm(p.xz*4.+p.y*vec2(.32,1.1));
    float profile=terrainFbm(p.xz*vec2(10.,.65)+p.y*vec2(1.9,8.));
    float weather=terrainFbm(p.xz*.82+p.y*vec2(.26,1.1));
    diffuseColor.rgb*=.74+grain*.27+profile*.19+weather*.12;
    diffuseColor.rgb+=vec3(.03,.021,.013)*pow(terrainNoise(p.xz*36.+p.y*48.),4.);
  `,
  stone:`
    vec3 p=islandPosition;
    vec3 scan=triplanar(surfaceAlbedo,p*.48,vec2(2.,0.));
    vec3 mossScan=sampleTile(surfaceAlbedo,p.xz*.54+p.y*.25,vec2(1.,0.)).rgb;
    diffuseColor.rgb*=mix(vec3(.62),scan*3.6,.64);
    diffuseColor.rgb=mix(diffuseColor.rgb,mossScan*.64,smoothstep(.48,.67,terrainFbm(p.xz*.17+p.y*.26))*.57);
    float rock=terrainFbm(vec2(p.x+p.y*.45,p.z-p.y*.83)*2.9);
    float grain=terrainNoise(vec2(p.x+p.y*1.32,p.z-p.y*.43)*16.);
    float strata=sin(p.y*12.+terrainNoise(p.xz*.65)*4.);
    diffuseColor.rgb*=.74+rock*.45+grain*.15+strata*.046;
    float moss=smoothstep(.52,.73,terrainFbm(p.xz*.66+p.y*.52))*.42;
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.10,.14,.06)*(.65+rock*.6),moss);
  `,
  wood:`
    vec3 p=islandLocal;
    vec3 scan=sampleTile(surfaceAlbedo,vec2(atan(p.z,p.x)*.40,p.y*.58),vec2(0.,1.)).rgb;
    diffuseColor.rgb*=mix(vec3(.65),scan*3.8,.75);
    float grooves=(.9+.1*sin(p.y*42.+terrainNoise(p.xz*24.)*4.));
    diffuseColor.rgb*=grooves;
    vec2 t=vec2((p.x+p.z*.53)*11.,p.y*.54);
    float grain=terrainFbm(t);
    float veins=sin(t.x*7.+terrainNoise(t*.48)*5.+p.z*18.);
    diffuseColor.rgb*=.73+grain*.36+veins*.071+terrainNoise(t*4.)*.1;
  `,
  foliage:`
    vec2 p=islandUv;
    float midrib=1.-smoothstep(.008,.033,abs(p.y-.5));
    float veins=pow(max(0.,sin(p.x*61.-abs(p.y-.5)*12.)),6.);
    float veinShading=veins*.057+midrib*.073;
    diffuseColor.rgb*=.86+terrainNoise(p*vec2(9.,5.))*.21+veinShading;
    diffuseColor.rgb+=diffuseColor.rgb*.11;
  `,
  fabric:`
    vec3 p=islandLocal;
    vec2 uv=vec2(p.x+p.z*.23,p.y+p.z*.15);
    float weave=sin(uv.x*900.)*sin(uv.y*900.);
    float fade=terrainFbm(p.xz*.54+vec2(p.y*.73,p.y*.13));
    float stains=smoothstep(.57,.77,terrainFbm(uv*6.5));
    diffuseColor.rgb*=.80+terrainFbm(uv*42.)*.19+weave*.033+fade*.17;
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.68,.66,.53),stains*.58);
  `,
}

const economyGround=`
    vec2 p=islandPosition.xz;
    float wetBiome=islandWeights.x;
    float sandy=islandWeights.z;
    vec3 soil=sampleTile(surfaceAlbedo,p*.68,vec2(0.,0.)).rgb;
    vec3 sand=sampleTile(surfaceAlbedo,p*.48,vec2(1.,1.)).rgb;
    diffuseColor.rgb*=mix(vec3(.78),mix(soil*3.05,sand*2.84,sandy),.65);
    float damp=0.;
    if(islandPosition.y<1.7){
      float latest=sin(shoreWavePhase(p,coastDistance(p),islandTime-.69));
      damp=1.-smoothstep(.46,1.14,islandPosition.y-latest*.19);
    }
    float sandTint=smoothstep(-.01,.08,diffuseColor.r-diffuseColor.g);
    diffuseColor.rgb*=mix(vec3(1.),vec3(.57,.63,.65),damp*sandTint*.82);
    diffuseColor.rgb*=.86+.23*terrainNoise(p*.59)+.07*wetBiome;
`

const materialCache=new Map<string,T.MeshStandardMaterial>()
type Options=T.MeshStandardMaterialParameters & {wind?:number;economy?:boolean}
export function islandMaterial(style:Style, options:Options={}){
  const {wind=0,economy=false,...parameters}=options
  const vertexColor=Boolean(parameters.vertexColors)
  const key=[style,wind,economy,vertexColor,parameters.color,parameters.roughness,parameters.metalness,parameters.side].join(':')
  const existing=materialCache.get(key)
  if(existing)return existing
  const material=new T.MeshStandardMaterial({roughness:.91,...parameters})
  material.name=style
  material.customProgramCacheKey=()=>key
  material.onBeforeCompile=shader=>{
    shader.uniforms.islandTime=islandTime
    shader.uniforms.surfaceAlbedo=surfaceAlbedo
    shader.uniforms.surfaceNormals=surfaceNormals
    const ground=style==='ground'
    const photo=ground||style==='architecture'||style==='stone'||style==='wood' 
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
varying vec3 islandPosition;
varying vec3 islandLocal;
varying vec2 islandUv;
uniform float islandTime;
${ground?'attribute vec3 surfaceWeights; varying vec3 islandWeights;':''}`)
      .replace('#include <begin_vertex>',`#include <begin_vertex>
islandLocal=position;
${ground?'islandWeights=surfaceWeights;':''}
islandUv=uv;
vec4 plantOrigin=vec4(0.,0.,0.,1.);
#ifdef USE_INSTANCING
plantOrigin=instanceMatrix*plantOrigin;
#endif
float sway=sin(islandTime*.83+plantOrigin.x*.127+plantOrigin.z*.091)+sin(islandTime*1.7+plantOrigin.z*.19)*.39;
transformed.x+=sway*clamp(position.y*.35,0.,1.8)*${wind.toFixed(4)};
transformed.z+=sway*.48*clamp(position.y*.35,0.,1.8)*${wind.toFixed(4)};
vec4 plotPosition=vec4(transformed,1.);
#ifdef USE_INSTANCING
plotPosition=instanceMatrix*plotPosition;
#endif
islandPosition=(modelMatrix*plotPosition).xyz;`)
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 islandPosition;
varying vec3 islandLocal;
varying vec2 islandUv;
${noiseGLSL}
${ground?'varying vec3 islandWeights; uniform float islandTime;'+shoreFoamGLSL+seaWavesGLSL:''}
${photo?atlasGLSL:''}`)
      .replace('#include <color_fragment>',`#include <color_fragment>
${ground&&economy?economyGround:surfaceSnippets[style]}`)
    if(ground)shader.fragmentShader=shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.58,damp*sandTint*.56);',
    )
    if(photo&&!economy){
      const textureScale=style==='ground'?'9.4':'12.0'
      const uv=style==='wood'?'vec2(atan(islandLocal.z,islandLocal.x)*.4,islandLocal.y*.58)':style==='ground'?'islandPosition.xz*.63':'vec2(islandPosition.x+islandPosition.y*.19,islandPosition.z+islandPosition.y*.23)*.48'
      const tile=style==='wood'?'vec2(0.,1.)':style==='ground'?'vec2(0.,0.)':style==='stone'?'vec2(2.,0.)':'vec2(3.,0.)'
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
vec3 materialCoord=islandPosition*${textureScale};
float stoneRelief=terrainNoise(materialCoord.xz+materialCoord.y*vec2(.41,.78));
vec3 bump=vec3(dFdx(stoneRelief),0.,dFdy(stoneRelief));
normal=normalize(normal+bump*0.065);
vec2 atlasUv=${uv};
vec3 scannedNormal=sampleTile(surfaceNormals,atlasUv,${tile}).rgb*2.-1.;
normal=surfaceNormal(normal,-vViewPosition,atlasUv,scannedNormal,.57);`)
    }
  }
  materialCache.set(key,material)
  return material
}
export const islandTime={value:0}

