import test from 'node:test'
import assert from 'node:assert/strict'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { canopyPixels } from '../src/assets/canopy.ts'
import { islandTree } from '../src/foliage-geometry.ts'
import { canWalk, sceneryObstacleAt, walk } from '../src/navigation.ts'
import { decodeSave, emptyProgress } from '../src/progress.ts'
import { beachBoulders, coastBoulders, forestLogs, waterfallBoulders } from '../src/solid-landmarks.ts'
import { plants, treeSpecies } from '../src/vegetation-layout.ts'
import { makeSeaSurface, seaDisplacement, seaLevel, shoreWavePhase } from '../src/water-surface.ts'
import { shore } from '../src/world-data.ts'

test('every palm and broadleaf or conifer has a solid base, with four distinct non-palm species',()=>{
  assert.deepEqual(new Set(plants.tree.map(treeSpecies)),new Set(['laurel','dracaena','fig','pine']))
  for(const plant of [...plants.tree,...plants.palm]){
    assert.equal(sceneryObstacleAt(plant.x,plant.z)?.kind,'trunk')
    assert.equal(canWalk(plant.x,plant.z,false),false)
  }
})

test('each crown uses its own populated texture tile, including its lower-distance model',async()=>{
  const pixelMap=await loadImage(Buffer.from(canopyPixels.split(',')[1],'base64'))
  assert.equal(pixelMap.width,512)
  assert.equal(pixelMap.height,512)
  const ctx=createCanvas(512,512).getContext('2d')
  ctx.drawImage(pixelMap,0,0)
  for(const [i,species] of (['laurel','dracaena','fig','pine'] as const).entries()){
    const u=(i%2)*.5,v=Math.floor(i/2)*.5
    const rgba=ctx.getImageData(u*512,v*512,256,256).data
    let covered=0
    for(let j=3;j<rgba.length;j+=4)if(rgba[j]>80)covered++
    assert.ok(covered>8200 && covered<27500)
    for(const near of [true,false]){
      const model=islandTree(species,943,near)
      const uv=model.leaf.getAttribute('uv')
      for(let j=0;j<uv.count;j++)assert.ok(uv.getX(j)>u&&uv.getX(j)<u+.5&&uv.getY(j)>v&&uv.getY(j)<v+.5)
      model.leaf.dispose();model.wood.dispose()
    }
  }
})

test('large scattered boulders and landmarks use the same placements for drawing and collision',()=>{
  const boulders=plants.rock.filter(p=>p.s*(p.squash*.89-.24)>=.3)
  assert.ok(boulders.length>175)
  for(const rock of boulders)assert.ok(sceneryObstacleAt(rock.x,rock.z))
  for(const [[x,,z],[,ry]] of [...beachBoulders,...coastBoulders(),...waterfallBoulders()]){
    if(ry>.77)assert.ok(sceneryObstacleAt(x,z),'boulder at '+x+','+z)
  }
  for(const [x,z,bx,bz] of forestLogs)assert.ok(sceneryObstacleAt((x+bx)*.5,(z+bz)*.5))
})

test('a sprint step cannot tunnel; oblique movement can slide and go around',()=>{
  const testCases=[[5,187,10,'trunk'],[4.6,201.6,11,'rock']] as const
  for(const [x,z,start,type] of testCases){
    assert.equal(sceneryObstacleAt(x,z)?.kind,type)
    assert.ok(canWalk(start,z,false))
    const hit=walk(start,z,-(start-x)*2,0,false,false)
    assert.ok(hit.x>x+.5 && hit.x<start-1)
    assert.equal(hit.z,z)
    assert.ok(canWalk(hit.x,hit.z,false))
    const jump=walk(start,z,-(start-x)*2,0,false,true)
    assert.deepEqual(jump,hit)
    const slide=walk(hit.x,hit.z,-1.3,1.7,false,false)
    assert.ok(slide.z>hit.z+1)
    assert.ok(canWalk(slide.x,slide.z,false))
    const detour=walk(start,z+4,-(start-x)*1.2,0,false,false)
    assert.ok(detour.x<x)
  }
})

test('an older save inside a new trunk recovers on the same beach without losing its journal',()=>{
  const p=emptyProgress()
  p.pose={x:5,z:187,yaw:.4,pitch:-.13}
  p.collected=['wreck','landing']
  p.elapsed=91
  const restored=decodeSave(JSON.stringify(p))
  assert.ok(restored)
  const {x,z,yaw,pitch}=restored.pose
  assert.ok(canWalk(x,z,false))
  assert.ok(Math.hypot(x-5,z-187)<1)
  assert.equal(yaw,.4)
  assert.equal(pitch,-.13)
  assert.deepEqual(restored.collected,p.collected)
  assert.equal(restored.elapsed,91)
})

test('the coastal mesh follows the terrain and closes its seam at both quality settings',()=>{
  for(const low of [false,true]){
    const geometry=makeSeaSurface(low)
    const pos=geometry.getAttribute('position'), offsets=geometry.getAttribute('shoreOffset')
    const rows=pos.count/(low?321:569)
    assert.ok(rows>48)
    for(let i=0;i<rows;i++){
      const last=pos.count-rows+i
      assert.equal(pos.getX(i),pos.getX(last))
      assert.equal(pos.getZ(i),pos.getZ(last))
      assert.equal(offsets.getX(i),offsets.getX(last))
    }
    for(let i=0;i<pos.count;i+=83){
      assert.ok(Math.abs(-shore(pos.getX(i),pos.getZ(i))-offsets.getX(i)+seaLevel/.28)<.001)
    }
    const index=geometry.index!
    assert.equal(index.count,(low?320:568)*(rows-1)*6)
    const a=index.getX(0),b=index.getX(1),c=index.getX(2)
    const winding=(pos.getZ(b)-pos.getZ(a))*(pos.getX(c)-pos.getX(a))-(pos.getX(b)-pos.getX(a))*(pos.getZ(c)-pos.getZ(a))
    assert.ok(winding>0)
    geometry.dispose()
  }
})

test('swells displace vertices and breaking crests move toward land over time',()=>{
  const samples=Array.from({length:31},(_,i)=>seaDisplacement(29,228,8,i*.15))
  assert.ok(Math.max(...samples)-Math.min(...samples)>.34)
  const close=shoreWavePhase(29,222,4,0)
  const offshore=shoreWavePhase(29,222,5,0)
  assert.ok(Math.abs(shoreWavePhase(29,222,4,1.16/1.61)-offshore)<.000001)
  assert.ok(close<offshore)
})
