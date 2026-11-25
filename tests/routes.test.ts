import test from 'node:test'
import assert from 'node:assert/strict'
import { items, itemsById } from '../src/content.ts'
import { bestTarget } from '../src/interaction.ts'
import { emptyProgress } from '../src/progress.ts'
import { makeRuntime } from '../src/runtime.ts'
import { floor, lookYaw, scope, spawn, tower } from '../src/world-data.ts'
import { canWalk } from '../src/navigation.ts'
import { firstApproach, stops } from './routes.mjs'

test('all 37 discoveries have a valid approach, including early and late archive states',()=>{
  const p=emptyProgress()
  for(const item of items){
    const [x,z]=stops[item.id]
    assert.ok(canWalk(x,z,item.area==='archive'),item.id+' stand')
    const runtime=makeRuntime({x,z,yaw:lookYaw(item.x-x,item.z-z),pitch:0})
    const available={...p,solved:item.area==='archive'?['tide'] as const:item.id==='lens'?['lockbox'] as const:[]}
    assert.equal(bestTarget(runtime,{...available,solved:[...available.solved]})?.id,item.id,item.id+' targeted')
  }
  const final=itemsById.final
  const outside=makeRuntime({x:156,z:38,yaw:lookYaw(final.x-156,final.z-38),pitch:0})
  assert.notEqual(bestTarget(outside,p)?.id,'final')
})

test('all core trail segments are connected through valid walking terrain',()=>{
  const groups = [
    [[spawn.x,spawn.z],stops.wreck,[22,193],stops.landing,...firstApproach.sand,...firstApproach.forest],
    [[-67,67],...firstApproach.falls,stops.keeper,stops.lamp,[-119.5,-54],...firstApproach.ruins],
    [[5,-39],...firstApproach.tower,stops['tower-log'],stops.repair,stops.sight],
    [stops.sight,...firstApproach.coast,stops.bearing,...firstApproach.archive,stops.tide],
  ]
  for(const path of groups)for(let i=1;i<path.length;i++){
    const [ax,az]=path[i-1],[bx,bz]=path[i]
    const steps=Math.ceil(Math.hypot(bx-ax,bz-az)*8)
    let previous=floor(ax,az)
    for(let step=0;step<=steps;step++){
      const x=ax+(bx-ax)*step/steps,z=az+(bz-az)*step/steps
      assert.ok(canWalk(x,z,false),'blocked path near '+x.toFixed(1)+','+z.toFixed(1))
      const elevation=floor(x,z)
      assert.ok(elevation-previous<.35,'steep step near '+x.toFixed(1)+','+z.toFixed(1))
      previous=elevation
    }
  }
})

test('both built ranging boards align with the scope when seen from the tower',()=>{
  const [x,y,z]=scope.origin
  assert.ok(floor(x,z)===tower.top)
  const directions=scope.stations.map(s=>{
    const horizontal=Math.hypot(s.x-x,s.z-z)
    return {bearing:Math.atan2(s.x-x,z-s.z)*180/Math.PI, slope:(y-s.lampY)/horizontal}
  })
  assert.ok(Math.abs(directions[0].bearing-scope.heading)<1)
  assert.ok(Math.abs(directions[1].bearing-scope.heading)<1)
  assert.ok(Math.abs(directions[0].slope-directions[1].slope)<.015)
})
