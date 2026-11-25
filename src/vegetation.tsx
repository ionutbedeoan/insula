import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as T from 'three'
import { islandTree, palmGeometry, shorelineRock, understory } from './foliage-geometry.ts'
import { islandMaterial } from './island-materials.ts'
import type { Settings } from './progress.ts'

import { canopyDepth, canopyMaterial } from './canopy-material.ts'
import { plants, treeProfile, treeSpecies, variants, type Kind, type Plant, type TreeSpecies } from './vegetation-layout.ts'

const foliageMaterial=islandMaterial('foliage',{side:T.DoubleSide,vertexColors:true,roughness:.87,wind:.118})
const woodMaterial=islandMaterial('wood',{vertexColors:true,roughness:.95,wind:0})
const rockMaterial=islandMaterial('stone',{roughness:.92})
const lowGrass=islandMaterial('foliage',{side:T.DoubleSide,vertexColors:true,roughness:.95,wind:.079})

function Batch({geometry,list,material,shadow=false,texture='leaf',depth}:{
  geometry:T.BufferGeometry;list:Plant[];material:T.Material;shadow?:boolean;depth?:T.Material;texture?:'leaf'|'wood'|'rock'
}){
  const mesh=useRef<T.InstancedMesh>(null)
  useLayoutEffect(()=>{
    if(!mesh.current)return
    const object=new T.Object3D(),color=new T.Color()
    const rockColor=new T.Color('#606963'),chalk=new T.Color('#9d947e')
    list.forEach(({x,y,z,s,turn,tint,squash},i)=>{
      object.position.set(x,y,z);object.rotation.set(0,turn,0)
      object.scale.set(s,texture==='rock'?s*squash:s,s)
      object.updateMatrix()
      mesh.current!.setMatrixAt(i,object.matrix)
      if(texture==='rock')color.copy(rockColor).lerp(chalk,Math.min(1,(tint-.6)*2.1))
      else color.setRGB(tint,tint,Math.min(1,tint*.94))
      mesh.current!.setColorAt(i,color)
    })
    mesh.current.instanceMatrix.needsUpdate=true
    if(mesh.current.instanceColor)mesh.current.instanceColor.needsUpdate=true
    mesh.current.computeBoundingSphere()
  },[list,texture])
  return <instancedMesh ref={mesh} args={[geometry,material,list.length]} castShadow={shadow} customDepthMaterial={depth} receiveShadow={texture!=='leaf'||Boolean(depth)} dispose={null}/>
}

export function Vegetation({low,quality}:{low:boolean;quality?:Settings['quality']}){
  const geometries=useMemo(()=>{
    const palm=[221,955,329].map(seed=>[palmGeometry(seed,false),palmGeometry(seed,true)])
    const tree=Object.fromEntries((Object.keys(treeProfile) as TreeSpecies[]).map((species,i)=>[species,
      [islandTree(species,943+i*314,false),islandTree(species,943+i*314,true)]])) as Record<TreeSpecies,ReturnType<typeof islandTree>[]>
    return {palm,tree,fern:[understory('fern',697,false),understory('shrub',188,true),understory('fern',697,true),understory('shrub',188,false)],grass:understory('grass',921,false),rock:[shorelineRock(522,1),shorelineRock(606,2)]}
  },[])
  const chunks=useMemo(()=>variants.flatMap(type=>{
    const cells=new Map<string,{type:Kind; list:Plant[];id:string; cx:number;cz:number;variant:number;species?:TreeSpecies}>()
    plants[type].forEach((plant,index)=>{
      if(low&&type==='grass'&&index%3!==0)return
      const cell=type==='grass'||type==='fern'?77:88
      const cx=Math.floor(plant.x/cell),cz=Math.floor(plant.z/cell)
      const variant=type==='palm'?index%3:type==='rock'?index%2:type==='fern'?index%4===0?1:0:0
      const species=type==='tree'?treeSpecies(plant):undefined
      const key=[cx,cz,species??variant].join(':')
      if(!cells.has(key))cells.set(key,{type,list:[],id:type+':'+key,cx:(cx+.5)*cell,cz:(cz+.5)*cell,variant,species})
      cells.get(key)!.list.push(plant)
    })
    return [...cells.values()]
  }),[low])
  const details=useRef<T.Group[]>([]), distant=useRef<T.Group[]>([])
  useFrame(({camera})=>{
    for(let i=0;i<chunks.length;i++){
      const {type,cx,cz}=chunks[i]
      const near=Math.hypot(camera.position.x-cx,camera.position.z-cz)<(type==='grass'?143:low?53:109)
      if(details.current[i])details.current[i].visible=near
      if(distant.current[i])distant.current[i].visible=type!=='grass'&&!near
    }
  })
  const draw=(type:Kind,variant:number,list:Plant[],detail:boolean,species?:TreeSpecies)=>{
    if(type==='palm'||species){
      const models=species?geometries.tree[species]:geometries.palm[variant]
      const model=models[Number(detail&&!low)]
      return <><Batch geometry={model.wood} material={woodMaterial} list={list} texture="wood" shadow={quality==='high'||detail&&!low}/>
        <Batch geometry={model.leaf} material={species?canopyMaterial:foliageMaterial} list={list} depth={species?canopyDepth:undefined} shadow={detail&&!low}/></>
    }
    if(type==='rock')return <Batch geometry={geometries.rock[variant]} material={rockMaterial} list={list} texture="rock" shadow={detail&&!low}/>
    if(type==='fern')return <Batch geometry={geometries.fern[variant===1?(detail&&!low?1:3):detail&&!low?2:0]} material={foliageMaterial} list={list}/>
    return <Batch geometry={geometries.grass} material={lowGrass} list={list}/>
  }
  return <group>{chunks.map(({type,id,list,variant,species},i)=><group key={id}>
    <group ref={node=>{if(node)details.current[i]=node}}>{draw(type,variant,list,true,species)}</group>
    {type!=='grass'&&<group ref={node=>{if(node)distant.current[i]=node}}>{draw(type,variant,list,false,species)}</group>}
  </group>)}</group>
}
