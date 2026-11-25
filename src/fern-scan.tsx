import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as T from 'three'
import { fernMeshes, fernPixels } from './assets/fern-02.ts'
import { islandTime } from './island-materials.ts'
import { fieldSites } from './fieldwork.ts'
import { items } from './content.ts'
import { height, rng, trailDistance } from './world-data.ts'

const data=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer
const models=fernMeshes.map(({p,n,u,i})=>{
  const g=new T.BufferGeometry()
  g.setAttribute('position',new T.BufferAttribute(new Float32Array(data(p)),3))
  g.setAttribute('normal',new T.BufferAttribute(new Float32Array(data(n)),3))
  g.setAttribute('uv',new T.BufferAttribute(new Float32Array(data(u)),2))
  g.setIndex(new T.BufferAttribute(new Uint16Array(data(i)),1))
  return g
})
const texture=new T.Texture()
texture.flipY=false
texture.colorSpace=T.SRGBColorSpace
texture.anisotropy=4
if(typeof Image!=='undefined'){
  const bitmap=new Image()
  bitmap.onload=()=>{texture.image=bitmap;texture.needsUpdate=true}
  bitmap.src=fernPixels
}
const material=new T.MeshStandardMaterial({map:texture,side:T.DoubleSide,alphaTest:.44,roughness:.82})
material.name='fern-scan'
material.onBeforeCompile=shader=>{
  shader.uniforms.islandTime=islandTime
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float islandTime;')
    .replace('#include <begin_vertex>',`#include <begin_vertex>
#ifdef USE_INSTANCING
float offset=instanceMatrix[3].x*.22+instanceMatrix[3].z*.13;
transformed.x+=sin(islandTime*1.42+offset)*position.y*.13;
transformed.z+=cos(islandTime*1.06+offset)*position.y*.067;
#endif`)
}
type Plot={x:number;y:number;z:number;size:number;angle:number}
const plots=[[-21,149,18],[-21,134,19],[-45,115,17],[-55,96,16],[-69,82,12],[-108,-50,15],[-120,-54,10],[-108,-32,18],[-81,7,16],[-73,36,13],[-61,-29,15],[14,171,13]] as const
function plants(){
  const random=rng(9043)
  return plots.map(([cx,cz,target],n)=>{
    const samples:Plot[]=[]
    for(let i=0;samples.length<target&&i<target*9;i++){
      const x=cx+(random()-.5)*22,z=cz+(random()-.5)*23
      const d=trailDistance(x,z)
      if(d<1.55||d>13||items.some(k=>Math.hypot(x-k.x,z-k.z)<1.6)||fieldSites.some(k=>Math.hypot(x-k.point[0],z-k.point[1])<1.6))continue
      samples.push({x,y:height(x,z)-.035,z,size:1.12+random()*2.18,angle:random()*6.283})
    }
    return {samples,cx,cz,model:n%3}
  })
}
const groveEdges=[
  [-15.5,153.6,2.3],[-19.8,144.7,2.8],[-26.5,142.2,2.3],[-32.4,138.3,3.0],
  [-29.4,130.8,2.4],[-38.7,119.8,2.7],[-48.9,102.7,2.1],[-64.5,77.7,2.9],
] as const
function fernBanks(){
  const random=rng(188455)
  return groveEdges.map(([cx,cz,radius],model)=>{
    const points:Plot[]=[]
    for(let i=0;i<12;i++){
      const bearing=i*2.399+random()*.27,length=Math.sqrt(random())*radius
      const x=cx+Math.cos(bearing)*length,z=cz+Math.sin(bearing)*length
      if(trailDistance(x,z)<1.85||items.some(item=>Math.hypot(item.x-x,item.z-z)<1.9)||
        fieldSites.some(site=>Math.hypot(site.point[0]-x,site.point[1]-z)<2))continue
      points.push({x,z,y:height(x,z)-.036,size:1.45+random()*1.98,angle:random()*Math.PI*2})
    }
    return {samples:points,cx,cz,model:model%3}
  }).filter(plot=>plot.samples.length)
}
const samples=[...plants(),...fernBanks()]
export const fernPlacementCount=samples.reduce((count,plot)=>count+plot.samples.length,0)
function PlotBatch({plot,low}:{plot:typeof samples[number];low:boolean}){
  const ref=useRef<T.InstancedMesh>(null)
  const spots=useMemo(()=>low?plot.samples.filter((_,i)=>i%3===0):plot.samples,[low,plot])
  const geometry=models[low?plot.model%2:plot.model]
  useLayoutEffect(()=>{
    if(!ref.current)return
    const object=new T.Object3D(),tint=new T.Color(),random=rng(706+plot.cx)
    spots.forEach(({x,y,z,size,angle},i)=>{
      object.position.set(x,y,z);object.rotation.y=angle;object.scale.setScalar(size);object.updateMatrix()
      ref.current!.setMatrixAt(i,object.matrix)
      tint.setRGB(.55+random()*.36,.68+random()*.30,.56+random()*.39)
      ref.current!.setColorAt(i,tint)
    })
    ref.current.instanceMatrix.needsUpdate=true
    ref.current.computeBoundingSphere()
  },[plot,spots])
  useFrame(({camera})=>{if(ref.current)ref.current.visible=Math.hypot(camera.position.x-plot.cx,camera.position.z-plot.cz)<(low?58:98)})
  return <instancedMesh ref={ref} args={[geometry,material,spots.length]} receiveShadow dispose={null}/>
}
export function ForestFerns({low}:{low:boolean}){
  return <group>{samples.map((plot,i)=><PlotBatch key={i} plot={plot} low={low}/>)}</group>
}
