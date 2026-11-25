import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as T from 'three'
import { fieldSites } from './fieldwork.ts'
import { islandMaterial } from './island-materials.ts'
import { height, rng, smooth } from './world-data.ts'

const faunaMaterial=new T.MeshStandardMaterial({color:'#bd8347',roughness:.73})
const crabShell=new T.MeshStandardMaterial({color:'#985937',roughness:.75})
const deepBrown=new T.MeshStandardMaterial({color:'#422c26',roughness:.85})
const darkFeather=new T.MeshStandardMaterial({color:'#324641',roughness:.85})
const paleFeather=new T.MeshStandardMaterial({color:'#acaa7b',roughness:.88})
const wood=islandMaterial('architecture',{color:'#63523c',roughness:.88})
const iron=new T.MeshStandardMaterial({color:'#36413e',metalness:.58,roughness:.6})
const brass=new T.MeshStandardMaterial({color:'#b18b4d',metalness:.4,roughness:.49})
const fabric=new T.MeshStandardMaterial({color:'#b47a42',roughness:.88})
const painted=new T.MeshStandardMaterial({color:'#def0d7',roughness:.82})
const lens=new T.MeshPhysicalMaterial({color:'#537e74',metalness:.24,roughness:.15,clearcoat:.8})

function Beam({a,b,radius=.026,material=wood}:{a:[number,number,number];b:[number,number,number];radius?:number;material?:T.Material}){
  const from=new T.Vector3(...a), to=new T.Vector3(...b), direction=to.clone().sub(from)
  const rotation=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),direction.clone().normalize())
  return <mesh position={from.lerp(to,.5).toArray()} quaternion={rotation.toArray()} material={material} castShadow>
    <cylinderGeometry args={[radius*.83,radius,direction.length(),7]}/>
  </mesh>
}
function FieldLandmarks(){
  return <group>{fieldSites.map(site=>{
    const [x,z]=site.point, y=height(x,z)
    return <group key={site.id} position={[x,y,z]} rotation={[0,-site.facing*Math.PI/180,0]}>
      {site.type==='photo'?<>
        {[0,1,2].map(i=>{
          const a=i*Math.PI*2/3+.36
          return <Beam key={i} a={[Math.cos(a)*.63,0,Math.sin(a)*.63]} b={[Math.cos(a)*.075,1.23,Math.sin(a)*.075]} material={iron}/>
        })}
        <mesh position={[0,1.27,0]} material={iron} castShadow><boxGeometry args={[.26,.14,.135]}/></mesh>
        <mesh position={[0,1.28,-.099]} rotation={[Math.PI/2,0,0]} material={iron}><cylinderGeometry args={[.066,.065,.128,19]}/></mesh>
        <mesh position={[0,1.28,-.169]} rotation={[Math.PI/2,0,0]} material={lens}><cylinderGeometry args={[.055,.055,.014,17]}/></mesh>
        <mesh position={[.076,1.36,.026]} material={brass}><boxGeometry args={[.051,.045,.053]}/></mesh>
        <Beam a={[-.14,.30,.22]} b={[-.28,-.01,.51]}/>
      </>:site.type==='tide'?<>
        <Beam a={[0,0,0]} b={[0,1.8,0]} radius={.072}/>
        <mesh position={[0,1.14,.05]} material={painted} castShadow><boxGeometry args={[.23,1.19,.05]}/></mesh>
        {Array.from({length:9},(_,i)=><mesh key={i} position={[i%2?.027:-.021,.626+i*.12,.079]} material={i%3===0?fabric:iron}><boxGeometry args={[i%3===0?.181:.115,.026,.009]}/></mesh>)}
        <Beam a={[-.36,.01,.39]} b={[0,.59,0]}/>
      </>:<>
        <Beam a={[0,-.02,0]} b={[0,.83,0]} radius={.045}/>
        <mesh position={[.088,.75,.012]} material={wood} rotation={[-.16,-.08,-.05]} castShadow><boxGeometry args={[.31,.135,.033]}/></mesh>
        <mesh position={[.088,.75,.032]} material={fabric}><boxGeometry args={[.245,.071,.005]}/></mesh>
      </>}
    </group>
  })}</group>
}

const wingVertex=`
uniform float time;
attribute vec3 seed;
varying vec2 wingUv;
varying float wingTint;
void main(){
  wingUv=uv;
  vec3 p=position;
  float phase=seed.x+time*(.77+seed.z*.37);
  float angle=sin(phase*11.)*.95;
  p.y+=sin(angle)*abs(p.x)*.8;
  p.x*=cos(angle);
  p.x+=cos(phase*1.13)*(.7+.7*seed.z);
  p.z+=sin(phase)*(.6+.6*seed.z);
  p.y+=.15+sin(phase*1.64)*.37;
  vec4 plot=instanceMatrix*vec4(p,1.);
  wingTint=seed.y;
  gl_Position=projectionMatrix*modelViewMatrix*plot;
}`
const wingFragment=`
varying vec2 wingUv;
varying float wingTint;
void main(){
  vec2 uv=wingUv;
  float v=uv.y-.48;
  float w=uv.x;
  float shape=pow((w-.53)*1.84,2.)+pow(v*(1.89+w*.84),2.);
  if(shape>.88 || (w<.38&&abs(v)>.42))discard;
  float vein=pow(max(0.,sin(atan(v,w+.15)*26.)),11.);
  vec3 bright=mix(vec3(.42,.14,.036),vec3(.63,.34,.077),wingTint);
  vec3 color=mix(bright, vec3(.043,.026,.018),smoothstep(.54,.85,shape)*.95+vein*.23);
  color+=pow(max(0.,sin(w*33.)*cos(v*27.)),14.)*.12;
  gl_FragColor=vec4(color,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`
function Butterflies({low}:{low:boolean}){
  const mesh=useRef<T.InstancedMesh>(null)
  const count=low?13:31
  const groups=[[-24,141],[-31,125],[-51,98],[-105,-53],[-118,-58],[27,169],[31,-39],[-72,80]]
  const {geometry,poses,uniforms}=useMemo(()=>{
    const geometry=new T.BufferGeometry()
    geometry.setAttribute('position',new T.Float32BufferAttribute([0,0,-.06,.155,0,-.09,.16,0,.095,0,0,-.06,.16,0,.095,0,0,.052,0,0,-.06,-.16,0,.095,-.155,0,-.09,0,0,-.06,0,0,.052,-.16,0,.095],3))
    geometry.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,1,1,0,0,1,1,0,1,0,0,1,1,1,0,0,0,0,1,1,1],2))
    const random=rng(675), seeds=new Float32Array(count*3),poses:T.Object3D[]=[]
    for(let i=0;i<count;i++){
      const [cx,cz]=groups[i%groups.length]
      const x=cx+(random()-.5)*4,z=cz+(random()-.5)*4
      const pose=new T.Object3D()
      pose.position.set(x,height(x,z)+.74+random()*.61,z);pose.rotation.y=random()*6.28;pose.scale.setScalar(.77+random()*.58);pose.updateMatrix()
      poses.push(pose);seeds.set([random()*70,random(),random()],i*3)
    }
    geometry.setAttribute('seed',new T.InstancedBufferAttribute(seeds,3))
    return {geometry,poses,uniforms:{time:{value:0}}}
  },[count])
  const initialized=useRef<T.InstancedMesh|null>(null)
  useFrame(({clock})=>{
    if(mesh.current&&initialized.current!==mesh.current){
      poses.forEach((pose,i)=>mesh.current!.setMatrixAt(i,pose.matrix))
      mesh.current.instanceMatrix.needsUpdate=true
      initialized.current=mesh.current
    }
    uniforms.time.value=clock.elapsedTime
  })
  return <instancedMesh ref={mesh} geometry={geometry} args={[geometry,undefined,count]} frustumCulled={false}>
    <shaderMaterial vertexShader={wingVertex} fragmentShader={wingFragment} uniforms={uniforms} side={T.DoubleSide}/>
  </instancedMesh>
}

function Crabs(){
  const refs=useRef<T.Group[]>([])
  const legs=useRef<T.Group[]>([])
  const places=[[37,197],[38.5,196.5],[38.6,199],[8,201],[42,193],[232,-13],[241,12]]
  useFrame(({clock,camera})=>{
    for(let i=0;i<places.length;i++){
      const node=refs.current[i]
      if(!node)continue
      const [x,z]=places[i], t=clock.elapsedTime*.85+i*5.9, d=Math.hypot(camera.position.x-x,camera.position.z-z)
      node.visible=d<34
      if(!node.visible)continue
      const shy=1-smooth(2.9,8,d), px=x+Math.sin(t)*(.34+.53*shy),pz=z+Math.cos(t*.72)*(.25+.44*shy)
      node.position.set(px,height(px,pz)+.064,pz)
      node.rotation.y=Math.sin(t*.5)*.63+i
      for(let part=0;part<8;part++){
        const leg=legs.current[i*8+part]
        if(leg)leg.rotation.y=Math.sin(t*9+part*.83)*(.22+shy*.24)
      }
    }
  })
  return <group>{places.map(([x,z],i)=><group key={i} ref={node=>{if(node)refs.current[i]=node}} position={[x,height(x,z)+.07,z]}>
    <mesh material={crabShell} scale={[.105,.049,.081]}><sphereGeometry args={[1,12,8]}/></mesh>
    {[-1,1].map(side=><group key={side}>
      {Array.from({length:4},(_,j)=><group key={j} position={[side*.073,.004,(j-1.5)*.034]} ref={node=>{if(node)legs.current[i*8+j+(side===1?4:0)]=node}}>
        <Beam a={[0,0,0]} b={[side*.07,.023,.014]} material={crabShell} radius={.008}/>
        <Beam a={[side*.07,.023,.014]} b={[side*.11,-.056,.022]} material={deepBrown} radius={.005}/>
      </group>)}
      <mesh material={faunaMaterial} position={[side*.117,.021,-.094]} scale={[.048,.031,.039]}><sphereGeometry args={[1,9,7]}/></mesh>
      <mesh material={deepBrown} position={[side*.031,.046,-.062]}><sphereGeometry args={[.009,7,5]}/></mesh>
    </group>)}
  </group>)}</group>
}

function ForestBirds(){
  const birds=useRef<T.Group[]>([])
  const places=[[-56,83],[-90,25],[-24,139],[-119,-45],[81,-99]]
  useFrame(({clock,camera})=>{
    for(let i=0;i<places.length;i++){
      const bird=birds.current[i]
      if(!bird)continue
      const [x,z]=places[i], d=Math.hypot(camera.position.x-x,camera.position.z-z)
      bird.visible=d<88
      const t=clock.elapsedTime*.58+i*1.44, close=1-smooth(5,18,d)
      const lift=Math.max(close,Math.max(0,Math.sin(t*.22+.94))**8*.8)
      bird.position.set(x+Math.sin(t)*4.1*lift,height(x,z)+1.56+(1.16+Math.sin(t)*.63)*lift,z+Math.cos(t)*2.8*lift)
      bird.rotation.y=-t+.4
      bird.children[1].rotation.z=Math.sin(t*15)*.86*lift+(1-lift)*.94
      bird.children[2].rotation.z=-bird.children[1].rotation.z
    }
  })
  return <group>{places.map(([x,z],i)=><group key={i} ref={n=>{if(n)birds.current[i]=n}} position={[x,height(x,z)+1.3,z]}>
    <group>
      <mesh material={darkFeather} scale={[.10,.119,.202]}><sphereGeometry args={[1,12,9]}/></mesh>
      <mesh material={paleFeather} position={[0,-.05,-.087]} scale={[.086,.088,.14]}><sphereGeometry args={[1,10,8]}/></mesh>
      <mesh material={darkFeather} position={[0,.075,-.158]}><sphereGeometry args={[.066,11,9]}/></mesh>
      <mesh material={faunaMaterial} position={[0,.061,-.23]} rotation={[-Math.PI/2,0,0]}><coneGeometry args={[.022,.091,8]}/></mesh>
      <mesh material={darkFeather} position={[0,-.01,.227]} rotation={[.22,0,0]} scale={[.045,.026,.17]}><sphereGeometry args={[1,10,8]}/></mesh>
    </group>
    {[-1,1].map(side=><group key={side} position={[side*.069,.008,.004]}>
      <mesh material={darkFeather} position={[side*.14,0,.041]} rotation={[0,-side*.24,-side*.19]} scale={[.23,.041,.114]}><sphereGeometry args={[1,12,8]}/></mesh>
    </group>)}
  </group>)}</group>
}

export function LivingWorld({low}:{low:boolean}){
  return <><FieldLandmarks/><Butterflies low={low}/><ForestBirds/>{!low&&<Crabs/>}</>
}
