import test from 'node:test'
import assert from 'node:assert/strict'
import { itemsById, puzzleIds, relics, secrets, views } from '../src/content.ts'
import { answer, collect, completion, decodeSave, discover, doneCount, emptyProgress, has, objectives, objectAvailable, solved } from '../src/progress.ts'
import { archive, floor, height, shore, spawn, tower } from '../src/world-data.ts'
import { canWalk } from '../src/navigation.ts'

test('a fresh expedition starts ashore and has 12 objectives and 19 exploration rewards',()=>{
  const p=emptyProgress()
  assert.ok(canWalk(p.pose.x,p.pose.z,false))
  assert.equal(doneCount(p),0)
  assert.equal(objectives.length,12)
  assert.equal(relics.length+secrets.length+views.length,19)
  assert.equal(completion(p),0)
})
test('the island is organic and approximately 500 m in each direction',()=>{
  const limits=[Infinity,-Infinity,Infinity,-Infinity]
  for(let z=-260;z<=260;z+=2)for(let x=-260;x<=260;x+=2){
    if(shore(x,z)<0)continue
    limits[0]=Math.min(limits[0],x);limits[1]=Math.max(limits[1],x)
    limits[2]=Math.min(limits[2],z);limits[3]=Math.max(limits[3],z)
  }
  for(const width of [limits[1]-limits[0],limits[3]-limits[2]])assert.ok(width>=430&&width<=520)
  assert.ok(height(250,250)<0)
  assert.ok(!canWalk(250,250,false))
})
test('a numeric code can be retried and exposes the real lens exactly once',()=>{
  const p=emptyProgress()
  assert.equal(objectAvailable(p,itemsById.lens),false)
  assert.equal(answer(p,'lockbox','000').progress,p)
  const good=answer(p,'lockbox','472')
  assert.ok(good.correct)
  assert.ok(objectAvailable(good.progress,itemsById.lens))
  const next=collect(good.progress,itemsById.lens)
  assert.ok(has(next,'lens'))
  assert.equal(collect(next,itemsById.lens),next)
  assert.equal(answer(next,'lockbox','472').progress,next)
})
test('components and evidence can be collected in arbitrary order',()=>{
  let p=collect(emptyProgress(),itemsById.lamp)
  p=collect(p,itemsById.keeper)
  assert.equal(answer(p,'repair','lens,lamp').progress,p)
  p=answer(p,'lockbox','472').progress
  p=collect(p,itemsById.lens)
  assert.ok(!answer(p,'repair','lamp,lens').correct)
  p=answer(p,'repair','lens,lamp').progress
  assert.ok(solved(p,'repair'))
  assert.ok(!answer(p,'sight','151').correct)
  assert.ok(!answer(p,'relay','bell,sun,tide').correct)
  p=answer(p,'relay','air,sun,tide').progress
  assert.ok(!answer(p,'sight','130').correct)
  p=answer(p,'sight','151').progress
  assert.ok(!answer(p,'bearing','E').correct)
  p=answer(p,'bearing','ESE').progress
  assert.ok(!answer(p,'tide','High').correct)
  assert.ok(answer(p,'tide','Ebb').correct)
})
test('the archive cannot be read, discovered or walked through early',()=>{
  const p=emptyProgress()
  assert.equal(collect(p,itemsById.final),p)
  assert.equal(discover(p,'archive'),p)
  assert.equal(answer(p,'tide','Ebb').progress,p)
  assert.ok(!canWalk(archive.entryX,archive.z,false))
  assert.ok(canWalk(archive.entryX,archive.z,true))
  assert.ok(!canWalk(archive.x,archive.z+archive.halfZ,true))
})
test('the tower has a continuous stair route up to the sighting level',()=>{
  assert.ok(Math.abs(floor(tower.x,tower.stepStart)-tower.base)<.1)
  for(let z=tower.stepStart;z>=tower.front;z-=.1){
    assert.ok(canWalk(tower.x,z,false))
    assert.ok(Math.abs(floor(tower.x,z)-floor(tower.x,z-.1))<.18)
  }
  assert.equal(floor(tower.x,tower.z),tower.top)
})
test('loading validates saves and rejects invalid positions, arbitrary inventory and gate flags',()=>{
  assert.equal(decodeSave('garbled'),null)
  assert.equal(decodeSave('{"version":2}'),null)
  const corrupted={version:1,pose:{x:999,z:999,yaw:300},collected:['lens','final','made-up'],discovered:['archive','beach'],solved:['sight','tide','relay'],elapsed:-42}
  const parsed=decodeSave(JSON.stringify(corrupted))
  assert.ok(parsed)
  assert.deepEqual(parsed.pose,spawn)
  assert.deepEqual(parsed.collected,[])
  assert.deepEqual(parsed.discovered,['beach'])
  assert.deepEqual(parsed.solved,['relay'])
  assert.equal(parsed.elapsed,0)
})
test('a full expedition round-trips its position, six puzzles and ending',()=>{
  let p=emptyProgress()
  for(const id of ['wreck','landing','keeper','lamp','tower-log']) p=collect(p,itemsById[id])
  for(const id of ['beach','forest','camp','falls','ruins','tower','coast'] as const) p=discover(p,id)
  for(const [id,value] of [['lockbox','472'],['relay','air,sun,tide'],['repair','lens,lamp'],['sight','151'],['bearing','ESE'],['tide','Ebb']] as const){
    p=answer(p,id,value).progress
    if(id==='lockbox')p=collect(p,itemsById.lens)
  }
  p=discover(p,'archive')
  p=collect(p,itemsById.final)
  p.pose={x:172,z:38,yaw:-1.1,pitch:.1}
  p.elapsed=952
  assert.deepEqual(p.solved,puzzleIds)
  assert.equal(doneCount(p),12)
  assert.deepEqual(decodeSave(JSON.stringify(p)),p)
  assert.equal(doneCount(emptyProgress()),0)
})
