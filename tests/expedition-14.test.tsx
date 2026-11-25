import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { create } from '@react-three/test-renderer'
import { PerspectiveCamera, Raycaster, Vector3, type Mesh, type InstancedMesh } from 'three'
import { OpeningScenery } from '../src/opening-scenery.tsx'
import { Terrain } from '../src/landscape.tsx'
import { Structures } from '../src/structures.tsx'
import { Vegetation } from '../src/vegetation.tsx'
import { aimScope, scopeStop } from '../src/scope-optics.ts'
import { canWalk, sceneryObstacleAt } from '../src/navigation.ts'
import { notchRocks, openingSoil, openingStumps, shoreOffset, surfRocks } from '../src/opening-layout.ts'
import { floor, scope } from '../src/world-data.ts'
import { chartOffset, chartPins, chartsMatch } from '../src/chart-evidence.ts'
import { emptyProgress } from '../src/progress.ts'
import { surveyLeg, surveyFoot } from '../src/survey-gait.ts'
import { surveyCycle, surveyorAt } from '../src/surveyor.ts'

Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true,self:{requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{}}})

test('the real scope camera aligns both boards and has a clear central line through the near frame',async()=>{
  const camera=new PerspectiveCamera(71,16/9,.12,960)
  const center=(station:typeof scope.stations[number])=>new Vector3(station.x,station.lampY,station.z).project(camera)
  aimScope(camera,scopeStop.initial)
  const before=scope.stations.map(center)
  assert.ok(before.every(point=>Math.abs(point.x)>1))
  aimScope(camera,scope.heading)
  assert.equal(camera.fov,scopeStop.fov)
  const aligned=scope.stations.map(center)
  assert.ok(aligned.every(point=>Math.abs(point.x)<.04 && Math.abs(point.y)<.08))

  const renderer=await create(h('group',null,h(Terrain),h(Structures,{progress:{...emptyProgress(),solved:['relay']}}),
    h(Vegetation,{low:false}),h(OpeningScenery,{low:false})),{camera})
  const scene=renderer.scene.instance
  scene.updateMatrixWorld(true)
  const far=scope.stations[1]
  const target=new Vector3(far.x,far.lampY,far.z)
  const direction=target.clone().sub(camera.position),length=direction.length()
  const ray=new Raycaster(camera.position,direction.normalize(),camera.near,length+.25)
  const first=ray.intersectObject(scene,true)[0]
  assert.ok(first,'ray must touch the far board')
  const firstMesh=first.object as Mesh
  const material=Array.isArray(firstMesh.material)?firstMesh.material[0]:firstMesh.material
  assert.ok(first.distance>length-2,'blocked at '+first.distance+' of '+length+' by '+first.point.toArray().join(',')+' '+material.name+' instance '+first.instanceId)
  await renderer.unmount()
})

test('opening assets have bounded triangle counts and physical bases',async()=>{
  const renderer=await create(h(OpeningScenery,{low:false}))
  const rendered=new Map<string,InstancedMesh>()
  renderer.scene.instance.traverse(node=>{
    const item=node as InstancedMesh
    if(item.isInstancedMesh)rendered.set((Array.isArray(item.material)?item.material[0]:item.material).name,item)
  })
  for(const key of ['rock','log','stump']){
    const mesh=rendered.get('opening-'+key)
    assert.ok(mesh && mesh.count)
    assert.ok(mesh.geometry.index!.count/3<=6000)
    assert.ok(mesh.geometry.getAttribute('uv').count>500)
  }
  for(const rock of [...notchRocks,...surfRocks])assert.equal(sceneryObstacleAt(rock.x,rock.z)?.kind,'rock')
  for(const cut of openingStumps)assert.equal(canWalk(cut.x,cut.z,false),false)
  assert.ok(openingSoil(-27,143).litter>.75)
  assert.ok(openingSoil(-77,63).mud>.75)
  assert.ok(surfRocks.some(({x,z})=>Math.abs(shoreOffset(x,z))<=1.5))
  await renderer.unmount()
})

test('both chart registrations need to coincide within the same tolerance',()=>{
  assert.equal(chartPins.length,2)
  assert.equal(chartsMatch(chartOffset.x,chartOffset.y),false)
  assert.equal(chartsMatch(3,3),false)
  assert.equal(chartsMatch(-2,2),true)
  assert.equal(chartsMatch(0,0),true)
})

test('Inès alternates stance and swing, adjusts joints on slopes, and has four tasks',()=>{
  const step=.20
  const a=surveyFoot(step,0,true)
  const b=surveyFoot(step+.08,0,true)
  assert.equal(a.lift,0)
  assert.ok(Math.abs(b.forward-a.forward+.08)<1e-9)
  assert.ok(surveyFoot(step,1,true).lift>0)
  const motions=new Set()
  for(let time=0;time<surveyCycle;time+=.67){
    const pose=surveyorAt(time)
    if(pose.task)motions.add(pose.task)
    assert.ok(canWalk(pose.x,pose.z,false))
    for(const side of [0,1]){
      const leg=surveyLeg(pose.x,pose.z,floor(pose.x,pose.z),pose.yaw,pose.step,side,pose.walking,.855)
      assert.ok(Object.values(leg).every(Number.isFinite))
      assert.ok(leg.knee<=0&&leg.knee> -2.65)
    }
  }
  assert.deepEqual(motions,new Set(['measure','look','marker','write']))
})
