import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as T from 'three'
import { noiseGLSL } from './island-materials.ts'
import { makeSeaSurface, seaWavesGLSL } from './water-surface.ts'
import { surfRocks } from './opening-layout.ts'
import { rng } from './world-data.ts'

const sunlight=`
const vec3 SUN=vec3(-.499,.621,-.603);
vec3 coastalSky(vec3 d,float time){
  d=normalize(d);
  float h=max(d.y,0.);
  vec3 color=mix(vec3(.64,.73,.74),vec3(.16,.34,.55),pow(h,.48));
  float sun=max(dot(d,SUN),0.);
  color+=pow(sun,24.)*vec3(.36,.255,.107)+pow(sun,105.)*vec3(.23,.14,.052);
  float glow=smoothstep(.99963,.99994,sun);
  color+=glow*vec3(2.65,2.18,1.38);
  if(d.y>.035){
    vec2 q=d.xz/(d.y+.29)*4.1+vec2(4.1,-3.9)+time*.0012;
    float first=terrainFbm(q)+terrainNoise(q*.64)*.16;
    float body=smoothstep(.52,.72,first)*smoothstep(.035,.21,d.y)*.94;
    float edge=terrainFbm(q+vec2(-.13,.08));
    vec3 cloud=mix(vec3(.56,.61,.61),vec3(1.12,1.095,.98),smoothstep(.43,.8,edge));
    color=mix(color,cloud,body);
  }
  return color;
}
`
const skyVertex=`
varying vec3 vWorld;
void main(){
  vWorld=position+cameraPosition;
  gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);
}`
export const skyFragment=`
uniform float time;
varying vec3 vWorld;
${noiseGLSL}
${sunlight}
void main(){
  vec3 d=normalize(vWorld-cameraPosition);
  gl_FragColor=vec4(coastalSky(d,time),1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`
const seaVertex=`
uniform float time;
attribute float shoreOffset;
varying vec3 vWorld;
varying float vShore;
${seaWavesGLSL}
void main(){
  vWorld=(modelMatrix*vec4(position,1.)).xyz;
  vShore=shoreOffset;
  vWorld.y+=seaDisplacement(vWorld.xz,vShore,time);
  gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);
}`
const rockWaveCalls=surfRocks.map(({x,z,r})=>
  `rocks=max(rocks,foamAtRock(p,vec2(${x.toFixed(3)},${z.toFixed(3)}),${r.toFixed(3)},time,crest));`
).join('\n  ')
export const oceanFragment=`
uniform float time;
uniform float fidelity;
varying vec3 vWorld;
varying float vShore;
${noiseGLSL}
${sunlight}
${seaWavesGLSL}
float ripple(vec2 p,float time){
  return sin(dot(p,vec2(1.37,.84))-time*2.16)*.039
    +sin(dot(p,vec2(-2.75,1.92))-time*2.78)*.022
    +sin(dot(p,vec2(4.27,2.78))+time*3.61)*.012;
}
vec2 foamAtRock(vec2 point,vec2 center,float radius,float time,float crest){
  vec2 d=point-center;
  float reach=length(d);
  if(reach>radius+4.)return vec2(0.);
  vec2 intoLand=-normalize(center);
  float downstream=dot(d,intoLand);
  float side=abs(d.x*intoLand.y-d.y*intoLand.x);
  float wave=smoothstep(-.75,.68,crest);
  float splinter=terrainNoise(point*5.3+intoLand*time*1.4);
  float collar=(1.-smoothstep(.13,.64,abs(reach-radius*.86)))*smoothstep(.24,.76,splinter);
  float tail=smoothstep(.23,radius*1.46,downstream)*(1.-smoothstep(radius*1.55,radius+3.9,downstream));
  float split=1.-smoothstep(.12,.73,abs(side-(radius*.48+downstream*.10)));
  float wake=tail*split*smoothstep(.17,.66,splinter)*(.51+.49*sin(downstream*3.-time*4.1));
  float shade=tail*(1.-smoothstep(radius*.22,radius*.92,side));
  return vec2(max(collar*(.30+.69*wave),wake*.81),shade*.72);
}
void main(){
  vec2 p=vWorld.xz;
  float dist=vShore;
  float cameraRange=length(vWorld.xz-cameraPosition.xz);
  float depth=smoothstep(.2,59.,dist);
  float f=.21;
  vec2 radial=normalize(p);
  float local=seaDisplacement(p,dist,time);
  vec2 dx=vec2(f,0.),dz=vec2(0.,f);
  vec2 swellGradient=vec2(seaDisplacement(p+dx,dist+f*radial.x,time),seaDisplacement(p+dz,dist+f*radial.y,time))-local;
  float fine=ripple(p,time);
  vec2 fineGradient=vec2(ripple(p+dx,time),ripple(p+dz,time))-fine;
  vec2 gradient=swellGradient*(1.-.84*smoothstep(90.,455.,cameraRange))+fineGradient*(.47+.53*fidelity)*(1.-smoothstep(105.,307.,cameraRange));
  vec3 N=normalize(vec3(-gradient.x/f,1.,-gradient.y/f));
  vec3 V=normalize(cameraPosition-vWorld);
  float fresnel=.026+.83*pow(1.-max(dot(N,V),0.),4.65);
  vec3 R=reflect(-V,N);
  vec3 sky=fidelity>.5
    ?coastalSky(vec3(R.x,max(R.y,.033),R.z),time)
    :mix(vec3(.62,.71,.74),vec3(.20,.38,.54),sqrt(max(R.y,.0)));
  float beachLight=terrainFbm(p*.071);
  vec3 sand=mix(vec3(.218,.303,.215),vec3(.31,.39,.30),beachLight);
  vec3 water=mix(sand,vec3(.037,.233,.198),smoothstep(-.05,10.4,dist));
  water=mix(water,vec3(.013,.077,.105),depth);
  float refractPattern=sin(p.x*.48+p.y*.67+local*5.-time*.79)*cos(p.x*-.66+p.y*.42+fine*19.+time*.61);
  float caustic=pow(max(0.,refractPattern),5.)*(1.-smoothstep(1.3,15.,dist));
  water+=vec3(.116,.129,.071)*caustic;
  vec3 color=mix(water,sky*.73,fresnel);
  float sunGlint=max(dot(normalize(SUN+V),N),0.);
  color+=pow(sunGlint,81.)*vec3(.76,.65,.44)+pow(sunGlint,27.)*vec3(.097,.074,.044);
  float phase=shoreWavePhase(p,dist,time);
  float seam=terrainFbm(p*.57+vec2(-time*.046,time*.079));
  float roughFoam=terrainNoise(p*4.5+vec2(-time*.22,time*.12));
  float crest=sin(phase+(seam-.5)*2.27);
  float breaking=smoothstep(.59,.97,crest)*smoothstep(.23,.79,seam+roughFoam*.29);
  breaking*=1.-smoothstep(6.,21.,dist);
  float breakIn=sin(phase-1.04+(seam-.5)*2.84);
  float wash=smoothstep(.43,.94,breakIn)*smoothstep(.40,.72,seam*.83+roughFoam*.35);
  wash*=1.-smoothstep(1.,8.3,dist);
  float ebb=dist+sin(phase*.54)*.49+seam*.73;
  float wetLine=(1.-smoothstep(.06,1.4,abs(ebb)))*smoothstep(.30,.65,roughFoam);
  float offshore=pow(max(0.,local*2.38+fine*1.8),7.)*smoothstep(.50,.75,seam)*depth*.31;
  vec2 rocks=vec2(0.);
  if(cameraRange<120.&&dist<14.){${rockWaveCalls}}
  float foam=clamp((breaking*.91+wash*.57)*(1.-rocks.y)+wetLine*.58+offshore+rocks.x,0.,.96);
  color=mix(color,vec3(.77,.84,.81),foam);
  float haze=smoothstep(150.,715.,cameraRange);
  color=mix(color,vec3(.49,.62,.66),haze*.87);
  gl_FragColor=vec4(color,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

export function Sky(){
  const uniforms=useMemo(()=>({time:{value:0}}),[])
  useFrame(({clock})=>{uniforms.time.value=clock.elapsedTime})
  return <mesh frustumCulled={false} renderOrder={-5}><sphereGeometry args={[858,32,16]}/>
    <shaderMaterial uniforms={uniforms} vertexShader={skyVertex} fragmentShader={skyFragment} side={T.BackSide} depthWrite={false}/>
  </mesh>
}
export function Ocean({low=false}:{low?:boolean}){
  const uniforms=useMemo(()=>({time:{value:0},fidelity:{value:1}}),[])
  uniforms.fidelity.value=low?0:1
  useFrame(({clock})=>{uniforms.time.value=clock.elapsedTime})
  const surface=useMemo(()=>makeSeaSurface(low),[low])
  useEffect(()=>()=>surface.dispose(),[surface])
  return <mesh geometry={surface}>
    <shaderMaterial uniforms={uniforms} vertexShader={seaVertex} fragmentShader={oceanFragment}/>
  </mesh>
}

const cascadeVertex=`
varying vec2 vUv;
varying vec3 vWorld;
uniform float time;
void main(){
  vUv=uv;
  vec3 p=position;
  p.z+=sin(uv.y*19.+uv.x*7.+time*3.6)*.028+.012*cos(uv.x*21.+time*4.);
  vWorld=(modelMatrix*vec4(p,1.)).xyz;
  gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);
}`
export const waterfallFragment=`
uniform float time;
uniform float pool;
varying vec2 vUv;
varying vec3 vWorld;
${noiseGLSL}
void main(){
  if(pool>.5){
    vec2 p=vUv*2.-1.;
    float r=length(p);
    float deep=smoothstep(.24,.96,r);
    float churn=terrainFbm(p*12.+vec2(.08,time*.42));
    vec2 fromImpact=vUv-vec2(.37,.92);
    float impact=length(fromImpact*vec2(1.09,.82));
    float pulse=sin(impact*94.-time*5.4+churn*.95);
    float rings=smoothstep(.46,.96,pulse)*smoothstep(.018,.105,impact)*(1.-smoothstep(.28,.65,impact));
    float turbulent=terrainFbm(vec2(vUv.x*44.+time*.17,vUv.y*38.+time*.78));
    float bubbles=smoothstep(.49,.76,turbulent)*(1.-smoothstep(.031,.29,impact));
    float ripples=sin(p.x*41.+p.y*35.-time*1.38+churn*3.)*.51+sin(p.x*28.-p.y*29.+time*1.68)*.49;
    vec3 color=mix(vec3(.025,.136,.114),vec3(.160,.267,.196),deep);
    color+=vec3(.16,.25,.20)*(rings*.57+max(0.,ripples)*.16);
    color=mix(color,vec3(.65,.78,.73),bubbles*.65+(1.-smoothstep(.003,.075,impact))*.61);
    gl_FragColor=vec4(color,1.-smoothstep(.91,1.,r));
  }else{
    float pipes=terrainFbm(vec2(vUv.x*18.,vUv.y*.79+time*.33));
    float drift=sin(vUv.y*11.2+time*2.4)*.027+sin(vUv.y*6.3-time)*.016;
    float ribbons=terrainNoise(vec2((vUv.x+drift)*37.,vUv.y*4.8+time*1.45));
    float threads=terrainFbm(vec2(vUv.x*146.,vUv.y*14.+time*4.67));
    float rush=sin(vUv.y*65.+time*13.+pipes*4.3+vUv.x*7.);
    float strands=smoothstep(.28,.75,pipes*.39+ribbons*.32+threads*.29);
    float sides=smoothstep(0.,.116,vUv.x)*smoothstep(0.,.116,1.-vUv.x);
    float reflection=smoothstep(.5,.92,rush)*strands;
    vec3 color=mix(vec3(.048,.14,.15),vec3(.74,.86,.85),.16+strands*.76);
    color+=reflection*vec3(.19,.21,.21);
    gl_FragColor=vec4(color,sides*(.41+strands*.47+(1.-smoothstep(0.,.12,vUv.y))*.12));
  }
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`
const sprayVertex=`
uniform float time;
attribute vec3 seed;
varying float vFade;
void main(){
  float age=fract(seed.x+time*(.21+seed.y*.22));
  vec3 p=position;
  p.x+=(seed.y-.5)*6.8*age;
  p.y+=.3+sin(age*2.65)*(1.1+seed.z*1.9);
  p.z+=age*(.4+seed.z*2.5);
  vec4 mv=modelViewMatrix*vec4(p,1.);
  gl_Position=projectionMatrix*mv;
  gl_PointSize=clamp((46.+age*41.+seed.z*37.)/max(1.,-mv.z),1.,64.);
  vFade=sin(3.14159*age)*(.19+seed.z*.42);
}`
const sprayFragment=`
varying float vFade;
void main(){
  vec2 uv=(gl_PointCoord-.5)*2.;
  float r=length(uv);
  float a=(1.-smoothstep(.01,1.,r))*vFade;
  gl_FragColor=vec4(.73,.80,.76,a*.56);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`
function Spray(){
  const geometry=useMemo(()=>{
    const count=184,random=rng(10922)
    const g=new T.BufferGeometry(),points=new Float32Array(count*3),seed=new Float32Array(count*3)
    for(let i=0;i<count;i++){
      points.set([-109.2+(random()-.5)*5.3,16.17,-73+random()*.56],i*3)
      seed.set([random(),random(),random()],i*3)
    }
    g.setAttribute('position',new T.BufferAttribute(points,3));g.setAttribute('seed',new T.BufferAttribute(seed,3))
    return g
  },[])
  const uniforms=useMemo(()=>({time:{value:0}}),[])
  useFrame(({clock})=>{uniforms.time.value=clock.elapsedTime})
  return <points geometry={geometry} renderOrder={8}><shaderMaterial uniforms={uniforms}
    vertexShader={sprayVertex} fragmentShader={sprayFragment} transparent depthWrite={false}/></points>
}
export function Waterfall({low=false}:{low?:boolean}){
  const uniforms=useMemo(()=>({time:{value:0},pool:{value:0}}),[])
  const pool=useMemo(()=>({time:uniforms.time,pool:{value:1}}),[uniforms])
  const sheet=useMemo(()=>{
    const g=new T.PlaneGeometry(1,1,25,19),pos=g.attributes.position,uv=g.attributes.uv
    for(let i=0;i<pos.count;i++){
      const x=uv.getX(i),w=uv.getY(i)
      pos.setXYZ(i,(x-.5)*(1+.38*(1-w)**3),w-.5,(1-w)**4*.41+.024*Math.sin(x*32.))
    }
    return g
  },[])
  useFrame(({clock})=>{uniforms.time.value=clock.elapsedTime})
  return <group>
    <mesh position={[-108,16.082,-66.75]} rotation={[-Math.PI/2,0,0]} scale={[15.95,13.8,1]} renderOrder={5}>
      <planeGeometry/><shaderMaterial vertexShader={cascadeVertex} fragmentShader={waterfallFragment} uniforms={pool} transparent depthWrite={false}/>
    </mesh>
    {[[ -110.2,21.5,-74.91,4.5,10.88],[-106.37,20.64,-75.0,2.8,9.10],[-113.79,19.42,-74.17,1.32,6.58]].map(([x,y,z,w,h])=>
      <mesh key={x} position={[x,y,z]} scale={[w,h,4.7]} geometry={sheet} renderOrder={7}>
        <shaderMaterial vertexShader={cascadeVertex} fragmentShader={waterfallFragment} uniforms={uniforms} side={T.DoubleSide} transparent depthWrite={false}/>
      </mesh>
    )}
    {!low&&<Spray/>}
  </group>
}
