import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement, type ReactNode } from 'react'
import { create } from '@react-three/test-renderer'
import type { InstancedMesh, Mesh, Object3D } from 'three'
import { DistantIslands, Gulls, Terrain } from '../src/landscape.tsx'
import { Ocean, Sky } from '../src/water.tsx'
import { ExpeditionCharacters } from '../src/character.tsx'
import { makeRuntime } from '../src/runtime.ts'
import { ForestFerns, fernPlacementCount } from '../src/fern-scan.tsx'
import { Habitats } from '../src/habitats.tsx'
import { LivingWorld } from '../src/living-world.tsx'
import { Structures } from '../src/structures.tsx'
import { Vegetation } from '../src/vegetation.tsx'
import { vegetationCounts } from '../src/vegetation-layout.ts'
import { emptyProgress, type Progress } from '../src/progress.ts'

Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true,self:{
  requestAnimationFrame:(callback:FrameRequestCallback)=>setTimeout(()=>callback(performance.now()),16),
  cancelAnimationFrame:(timer:ReturnType<typeof setTimeout>)=>clearTimeout(timer)
}})

async function render(children:ReactNode){
  return create(createElement('group',null,children))
}

test('the procedural scene builds complete finite geometry and instance buffers', async ()=>{
  const renderer=await render([
    createElement(Sky,{key:'sky'}),createElement(Terrain,{key:'ground'}),
    createElement(Ocean,{key:'ocean'}),createElement(DistantIslands,{key:'horizon'}),
    createElement(Vegetation,{key:'flora',low:false}),
    createElement(Structures,{key:'structures',progress:emptyProgress()}),
    createElement(Gulls,{key:'gulls'})
  ])
  const scene=renderer.scene.instance as Object3D
  let meshes=0
  let instanced=0
  scene.traverse(node=>{
    const object=node as InstancedMesh
    if(!object.isMesh)return
    meshes++
    const attribute=object.geometry.getAttribute('position')
    assert.ok(attribute.count)
    for(const value of attribute.array)assert.ok(Number.isFinite(value))
    if(object.isInstancedMesh){
      instanced+=object.count
      assert.ok(object.instanceColor)
      assert.ok(Number.isFinite(object.boundingSphere?.radius))
    }
  })
  assert.ok(meshes>125)
  assert.deepEqual(vegetationCounts,{palm:602,tree:216,fern:1970,grass:8200,rock:545})
  const {palm,tree,fern,grass,rock}=vegetationCounts
  // One visible lod per batch, with leaves and bark drawn separately.
  assert.equal(instanced,(palm+tree)*4+(fern+rock)*2+grass)
  await renderer.advanceFrames(3,1/60)
  await renderer.unmount()
})

test('the archive gate moves when the save marks the tide puzzle solved', async ()=>{
  const progress=emptyProgress()
  const renderer=await create(createElement(Structures,{progress}))
  const scene=renderer.scene.instance as Object3D
  const door=scene.children.find((mesh):mesh is Mesh=>(mesh as Mesh).isMesh && mesh.position.x===158&&mesh.position.z===38)
  assert.ok(door)
  assert.equal(door.position.y,7)
  const unlocked:Progress={...progress,solved:['tide']}
  await renderer.update(createElement(Structures,{progress:unlocked}))
  await renderer.advanceFrames(60,1/60)
  assert.ok(door.position.y>10.3)
  await renderer.unmount()
})

test('the surveyor and playable avatar build and the surveyor moves with the expedition clock',async()=>{
  const runtime={current:makeRuntime()}
  const render=await create(createElement(ExpeditionCharacters,{runtime,menu:false,third:true}))
  runtime.current.cameraDistance=3.8
  await render.advanceFrames(1,1/60)
  const first={...runtime.current.npc}
  runtime.current.elapsed=10
  await render.advanceFrames(1,1/60)
  assert.ok(runtime.current.npc.walking)
  assert.ok(Math.hypot(runtime.current.npc.x-first.x,runtime.current.npc.z-first.z)>4)
  const scene=render.scene.instance as Object3D
  assert.equal(scene.children.filter(object=>object.visible).length,2)
  runtime.current.cameraDistance=.3
  await render.advanceFrames(1,1/60)
  assert.equal(scene.children.filter(object=>object.visible).length,1)
  await render.unmount()
})

test('habitat geology, plant patches and local wildlife integrate into the scene',async()=>{
  const render=await create(createElement('group',null,createElement(Habitats,{low:false}),createElement(ForestFerns,{low:false}),createElement(LivingWorld,{low:false})))
  await render.advanceFrames(2,1/60)
  let meshes=0,instances=0
  ;(render.scene.instance as Object3D).traverse(object=>{
    const mesh=object as InstancedMesh
    if(!mesh.isMesh)return
    meshes++
    assert.ok(mesh.geometry.getAttribute('position').count>0)
    if(mesh.isInstancedMesh)instances+=mesh.count
  })
  assert.ok(meshes>100)
  assert.ok(instances>450)
  assert.equal(fernPlacementCount,266)
  await render.unmount()
})
