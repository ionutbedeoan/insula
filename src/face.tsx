import * as T from 'three'
import { headPoints, headTriangles } from './assets/character-head.ts'

const decode=(value:string)=>Uint8Array.from(atob(value),letter=>letter.charCodeAt(0))
const coords=new Int16Array(decode(headPoints).buffer)
const geometry=new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(Float32Array.from(coords,x=>x/20000),3))
geometry.setIndex(new T.BufferAttribute(new Uint16Array(decode(headTriangles).buffer),1))
geometry.computeVertexNormals()
const tones=new Float32Array(coords.length)
const skinTone=new T.Color('#c59576'), flush=new T.Color('#9c584d'), pale=new T.Color('#e5ae91')
for(let i=0;i<coords.length;i+=3){
  const [x,y,z]=[coords[i]/20000,coords[i+1]/20000,coords[i+2]/20000]
  const cheek=Math.exp(-(((Math.abs(x)-.058)/.045)**2+((y+.024)/.033)**2+((z+.068)/.06)**2))
  const lip=Math.exp(-((x/.029)**2+((y+.058)/.012)**2+((z+.072)/.037)**2))
  const tint=skinTone.clone().lerp(flush,cheek*.37+lip*.42).lerp(pale,Math.max(0,y)*.96)
  tones.set([tint.r,tint.g,tint.b],i)
}
geometry.setAttribute('color',new T.BufferAttribute(tones,3))
const skin=new T.MeshPhysicalMaterial({vertexColors:true,roughness:.72,clearcoat:.11,clearcoatRoughness:.67})
const eyes=new T.SphereGeometry(1,12,8)
const sclera=new T.MeshStandardMaterial({color:'#ddd4c0',roughness:.38})
const iris=new T.MeshStandardMaterial({color:'#43574a',roughness:.52})
const pupil=new T.MeshStandardMaterial({color:'#201c18',roughness:.29})
export function ExpeditionFace({player}:{player:boolean}){
  return <group scale={player?[1.04,1.035,1.03]:[.99,1,1]}>
    <mesh geometry={geometry} material={skin} castShadow receiveShadow/>
    {[-1,1].map(side=><group key={side} position={[side*.041,.001,-.084]}>
      <mesh geometry={eyes} material={sclera} scale={[.014,.009,.008]}/>
      <mesh geometry={eyes} material={iris} position={[0,0,-.006]} scale={[.005,.006,.004]}/>
      <mesh geometry={eyes} material={pupil} position={[0,0,-.009]} scale={[.0028,.0033,.002]}/>
    </group>)}
  </group>
}
