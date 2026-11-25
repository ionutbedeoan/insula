import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from "@react-three/fiber"
import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { islandMaterial } from './island-materials.ts'
import { understory } from './foliage-geometry.ts'
import { fieldSites } from './fieldwork.ts'
import { basaltColumns, fallenLogs } from './solid-landmarks.ts'
import { items } from './content.ts'
import { height, rng, shore, trailDistance } from './world-data.ts'

const wood=islandMaterial('wood',{vertexColors:true,roughness:.92})
const lava=islandMaterial('stone',{vertexColors:true,roughness:.93})
const plants=islandMaterial('foliage',{vertexColors:true,side:T.DoubleSide,roughness:.81,wind:.086})
type Location=[x:number,z:number,extent:number]
const layer:Location[]=[[-21,148,13],[-32,120,16],[-49,106,19],[-75,84,14],[-103,-51,12],[-123,-57,8],[-118,-38,13],[-52,-22,21],[35,169,12],[5,181,14],[50,160,18]]
type Scatter={x:number;y:number;z:number;s:number;angle:number}
const leafGrass=islandMaterial('foliage',{vertexColors:true,side:T.DoubleSide,roughness:.94,wind:.074})
function tint(geometry:T.BufferGeometry,color:T.Color,random:()=>number){
  const values=new Float32Array(geometry.attributes.position.count*3)
  for(let i=0;i<values.length;i+=3){
    const shade=.87+random()*.23
    values.set([shade*color.r,shade*color.g,shade*color.b],i)
  }
  geometry.setAttribute('color',new T.BufferAttribute(values,3))
  return geometry
}
function combine(parts:T.BufferGeometry[]){
  const res=mergeGeometries(parts)
  parts.forEach(g=>g.dispose())
  return res
}
function logGeometry(){
  const random=rng(8391),parts:T.BufferGeometry[]=[]
  const bark=new T.Color('#7d6950')
  for(const [x,z,length,angle] of fallenLogs){
    const y=height(x,z)+.34, dx=Math.cos(angle),dz=Math.sin(angle)
    for(let i=0;i<7;i++){
      const xa=x+dx*(i/7-.5)*length,za=z+dz*(i/7-.5)*length
      const xb=x+dx*((i+1)/7-.5)*length,zb=z+dz*((i+1)/7-.5)*length
      const a=new T.Vector3(xa,height(xa,za)+.36,za),b=new T.Vector3(xb,height(xb,zb)+.32,zb)
      const direction=b.clone().sub(a),middle=a.clone().lerp(b,.5),r=.335-i*.026
      const g=new T.CylinderGeometry(r*.96,r*1.15,direction.length()+.035,13,1).toNonIndexed()
      g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize()))
      g.translate(middle.x,middle.y,middle.z)
      parts.push(tint(g,bark,random))
    }
    for(let i=0;i<7;i++){
      const px=x+dx*(random()-.5)*length*.9,pz=z+dz*(random()-.5)*length*.9
      const twig=new T.CylinderGeometry(.018,.117,.55+random()*.72,7).toNonIndexed()
      twig.rotateZ((random()-.5)*2.3);twig.rotateY(random()*6.3);twig.translate(px,y+.3,pz)
      parts.push(tint(twig,bark,random))
    }
    const capX=x-dx*length*.505,capZ=z-dz*length*.505
    for(let ring=1;ring<5;ring++){
      const ringRadius=ring*.068
      const end=new T.TorusGeometry(ringRadius,.014,6,17).toNonIndexed()
      end.rotateY(Math.atan2(dx,dz));end.translate(capX,height(capX,capZ)+.30,capZ)
      parts.push(tint(end,new T.Color(ring%2?'#9b7854':'#bc9868'),random))
    }
  }
  return combine(parts)
}
function volcanicCliffs(){
  const parts:T.BufferGeometry[]=[]
  for(const {x,z,r,h,seed} of basaltColumns()){
    const random=rng(seed),elevation=Math.max(-.25,height(x,z))
    const maker=new T.CylinderGeometry(r*(.69+random()*.34),r*1.18,h,6+Math.floor(random()*3),4).toNonIndexed()
    const p=maker.attributes.position
    for(let idx=0;idx<p.count;idx++){
      const yy=p.getY(idx),xx=p.getX(idx),zz=p.getZ(idx)
      const wear=1+.13*Math.sin(xx*2.+yy*1.3+zz*3)
      p.setXYZ(idx,xx*wear+yy*.08,yy+Math.sin(xx*2.9+zz)*.36,zz*wear+yy*.09)
    }
    maker.rotateY(random()*6.28)
    maker.translate(x,elevation+h*.17,z)
    maker.computeVertexNormals()
    const color=new T.Color('#4f5351').lerp(new T.Color('#7b7470'),random()*.67)
    parts.push(tint(maker,color,random))
  }
  return combine(parts)
}
function leafLayer(seed:number){
  const random=rng(seed)
  const verts:number[]=[],colors:number[]=[],uv:number[]=[],index:number[]=[]
  const rows=13,columns=6
  for(let i=0;i<9;i++){
    const angle=i*2.399+random()*.37,width=.13+random()*.15,rise=.50+random()*.66,length=.55+random()*.57
    const dx=Math.cos(angle),dz=Math.sin(angle)
    const c=new T.Color('#385c2c').lerp(new T.Color('#95a56e'),random()*.78)
    const roll=(random()-.5)*.36,stalk=.16+random()*.08
    const start=verts.length/3
    for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
      const t=row/rows,s=col/columns*2-1
      const span=Math.sin(Math.PI*t**.87)**.82*width
      const lateral=s*span+roll*t*t
      verts.push(
        dx*t*length+dz*lateral,
        rise*Math.sin(t*2.64)+stalk*t-(.10+.11*t)*s*s*Math.sin(t*Math.PI)+s*.045*Math.sin(t*Math.PI*3.1),
        dz*t*length-dx*lateral,
      )
      uv.push(t,col/columns)
      const tone=.88+.13*(1-Math.abs(s))+.04*Math.sin(i+row*.43+s)
      colors.push(c.r*tone,c.g*tone,c.b*tone)
      if(row<rows&&col<columns){
        const a=start+row*(columns+1)+col,b=a+columns+1
        index.push(a,a+1,b+1,a,b+1,b)
      }
    }
  }
  const geometry=new T.BufferGeometry()
  geometry.setAttribute('position',new T.Float32BufferAttribute(verts,3))
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2))
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  return geometry
}
function understoryScatter(){
  const zones:Scatter[][]=layer.map(()=>[])
  const random=rng(1677)
  layer.forEach(([cx,cz,extent],index)=>{
    for(let i=0;i<76;i++){
      const a=random()*Math.PI*2,d=Math.sqrt(random())*extent
      const x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d
      if(trailDistance(x,z)<2.85||shore(x,z)<7)continue
      if(items.some(i=>Math.hypot(x-i.x,z-i.z)<2.5)||fieldSites.some(i=>Math.hypot(x-i.point[0],z-i.point[1])<2.4))continue
      zones[index].push({x,y:height(x,z)-.02,z,s:.39+random()*.88,angle:random()*6.283})
    }
  })
  return zones
}
function vergeTufts(){
  const random=rng(57713)
  return layer.map(([cx,cz,extent])=>{
    const spots:Scatter[]=[]
    for(let i=0;i<180;i++){
      const theta=random()*Math.PI*2,range=Math.sqrt(random())*extent*1.08
      const x=cx+Math.cos(theta)*range,z=cz+Math.sin(theta)*range
      if(trailDistance(x,z)<1.72||shore(x,z)<9)continue
      const cluster=Math.cos(x*.74+z*.22)+Math.sin(z*.51-x*.37)
      if(cluster<-.43||items.some(i=>Math.hypot(x-i.x,z-i.z)<1.5))continue
      spots.push({x,y:height(x,z)-.032,z,s:.38+random()*.68,angle:random()*Math.PI*2})
    }
    return spots
  })
}
function LayerBatch({geometry,spots,grass=false,center}:{geometry:T.BufferGeometry;spots:Scatter[];grass?:boolean;center:Location}){
  const mesh=useRef<T.InstancedMesh>(null)
  useLayoutEffect(()=>{
    if(!mesh.current)return
    const object=new T.Object3D()
    const patch=new T.Color()
    const random=rng(272+spots.length)
    spots.forEach(({x,y,z,s,angle},i)=>{
      object.position.set(x,y,z);object.rotation.y=angle;object.scale.setScalar(s);object.updateMatrix()
      mesh.current!.setMatrixAt(i,object.matrix)
      patch.setHSL(.19+random()*.11,.21+random()*.19,.50+random()*.24)
      mesh.current!.setColorAt(i,patch)
    })
    mesh.current.instanceMatrix.needsUpdate=true
    mesh.current.computeBoundingSphere()
  },[spots])
  useFrame(({camera})=>{
    if(mesh.current)mesh.current.visible=Math.hypot(camera.position.x-center[0],camera.position.z-center[1])<(grass?80:125)
  })
  return <instancedMesh ref={mesh} args={[geometry,grass?leafGrass:plants,spots.length]} receiveShadow dispose={null}/>
}
export function Habitats({low}:{low:boolean}){
  const features=useMemo(()=>({logs:logGeometry(),cliffs:volcanicCliffs(),leaves:leafLayer(917),spots:understoryScatter(),grass:understory('grass',338,true),tufts:vergeTufts()}),[])
  return <group>
    <mesh geometry={features.logs} material={wood} castShadow={!low} receiveShadow/>
    <mesh geometry={features.cliffs} material={lava} castShadow={!low} receiveShadow/>
    {features.spots.map((list,i)=><LayerBatch key={i} center={layer[i]} geometry={features.leaves} spots={low?list.filter((_,index)=>index%3===0):list}/>)}
    {features.tufts.map((list,i)=><LayerBatch key={'grass'+i} center={layer[i]} geometry={features.grass} grass spots={low?list.filter((_,index)=>index%4===0):list}/>)}
  </group>
}
