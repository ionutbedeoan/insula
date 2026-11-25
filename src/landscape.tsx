import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as T from 'three'
import { openingSoil } from './opening-layout.ts'
import { biomeAt } from './biomes.ts'
import { islandMaterial, islandTime } from './island-materials.ts'
import { height, shore, smooth, trailDistance } from './world-data.ts'

function makeTerrain(low:boolean){
  const size=520, count=low?186:248
  const geometry=new T.PlaneGeometry(size,size,count,count).rotateX(-Math.PI/2)
  const pos=geometry.attributes.position
  const color=new T.Color(), sand=new T.Color('#c3ab81'), shade=new T.Color('#5d6848')
  const canopy=new T.Color('#40583d'), rock=new T.Color('#73786c'), path=new T.Color('#a49371')
  const colors=new Float32Array(pos.count*3), weights=new Float32Array(pos.count*3), wet=new T.Color('#8d7d65'), basalt=new T.Color('#5a5454')
  const litter=new T.Color('#61583e'),wrack=new T.Color('#967851'),mud=new T.Color('#756957')
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i),y=height(x,z),edge=shore(x,z)
    pos.setY(i,y)
    const brush=(Math.sin(x*.047+z*.045)+Math.sin(z*.09-x*.06)+2)/4
    color.copy(shade).lerp(canopy,smooth(.26,.82,brush))
    color.lerp(rock,smooth(.39,.71,Math.abs(height(x+1,z)-y)+Math.abs(height(x,z+1)-y))*.77)
    const wear=trailDistance(x,z)+.36*Math.sin(x*.74+z*.38)
    const track=1-smooth(.8,2.8,wear)
    color.lerp(path,track*.88)
    color.multiplyScalar(1-(1-smooth(.56,1.15,Math.abs(wear-.48)))*.077)
    color.lerp(sand,Math.max(1-smooth(9,27,edge), (1-smooth(3,8,y))*.40))
    color.lerp(wet,(1-smooth(2.8,8,edge))*.72)
    color.multiplyScalar(.91+.08*Math.sin(x*.83+z*.31)*Math.cos(z*.61)+.11*brush)
    const biome=biomeAt(x,z)
    const coastalSlope=smooth(.25,.8,Math.abs(height(x+.8,z)-y)+Math.abs(height(x,z+.8)-y))
    const volcanic=biome.lava*(.52+.48*coastalSlope)
    const sandy=Math.max(biome.beach, .29*(1-smooth(2.,18.,edge)))*(1-volcanic*.72)
    color.lerp(basalt,volcanic*.71)
    if(track>.4)color.lerp(path,track*.42)
    const opening=openingSoil(x,z)
    color.lerp(litter,opening.litter*(.71-track*.49))
    color.lerp(wrack,opening.wrack*.29)
    color.lerp(mud,opening.mud*.66)
    colors.set([color.r,color.g,color.b],i*3)
    weights.set([biome.wet,volcanic,sandy],i*3)
  }
  geometry.setAttribute('color',new T.BufferAttribute(colors,3))
  geometry.setAttribute('surfaceWeights',new T.BufferAttribute(weights,3))
  geometry.computeVertexNormals()
  return geometry
}
export function Terrain({low=false}:{low?:boolean}){
  const geometry=useMemo(()=>makeTerrain(low),[low])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  useFrame(({clock})=>{islandTime.value=clock.elapsedTime})
  return <mesh geometry={geometry} receiveShadow material={islandMaterial('ground',{vertexColors:true,roughness:.96,economy:low})}/>
}

export function DistantIslands(){
  const geometry=useMemo(()=>{
    const g=new T.IcosahedronGeometry(1,1)
    const points=g.attributes.position
    for(let i=0;i<points.count;i++){
      const x=points.getX(i),y=points.getY(i),z=points.getZ(i)
      points.setXYZ(i,x*(1+.21*Math.sin(z*5)),Math.max(-.08,y*(.74+.24*Math.cos(x*7))),z)
    }
    g.computeVertexNormals()
    return g
  },[])
  return <group>
    {[[300,-456,122,35,42],[-483,-200,124,40,65],[414,314,108,33,38],[-383,-277,96,32,71]].map(([x,z,w,h,d])=>
      <mesh key={x} geometry={geometry} position={[x,-1,z]} scale={[w,h,d]}><meshBasicMaterial color="#779d9d" fog={false}/></mesh>
    )}
  </group>
}

export function Gulls(){
  const group=useRef<T.Group>(null)
  const wings=useRef<T.Mesh[]>([])
  const geometry=useMemo(()=>{
    const g=new T.BufferGeometry()
    g.setAttribute('position',new T.Float32BufferAttribute([0,0,.25,-1.1,.14,.04,-.55,0,-.39,0,0,.25,-.55,0,-.39,0,0,-.21],3))
    g.computeVertexNormals()
    return g
  },[])
  useFrame(({clock})=>{
    if(!group.current) return
    const t=clock.elapsedTime*.24
    group.current.position.set(30+Math.cos(t)*44,22+Math.sin(t*1.8)*3,160+Math.sin(t)*36)
    group.current.rotation.y=-t+.4
    wings.current.forEach((wing,i)=>{ if(wing) wing.rotation.z=Math.sin(t*20+i*.31)*.23*(i%2===0?1:-1) })
  })
  return <group ref={group}>{[0,1,2,3,4].map((i)=><group key={i} position={[i*2.2,i%3*.55,-i*1.7]}>
    {[-1,1].map((side,index)=><mesh key={side} ref={node=>{if(node)wings.current[i*2+index]=node}} geometry={geometry} scale={[side,1,1]}><meshBasicMaterial color={i%2?'#f0e5ce':'#d6e2d8'} side={T.DoubleSide}/></mesh>)}
  </group>)}</group>
}
