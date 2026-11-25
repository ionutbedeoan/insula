import test from 'node:test'
import assert from 'node:assert/strict'
import { biomeAt } from '../src/biomes.ts'
import { compassGap, fieldReady, fieldSites, nearestFieldwork, tideReading } from '../src/fieldwork.ts'
import { decodeSave, emptyProgress } from '../src/progress.ts'
import { height, trailDistance } from '../src/world-data.ts'
import { canWalk } from '../src/navigation.ts'

test('field stations are reachable with a normal character and records suppress repeat prompts',()=>{
  for(const site of fieldSites){
    const [x,z]=site.point
    assert.ok(canWalk(x,z,false),site.id)
    assert.equal(nearestFieldwork(x,z,site.facing,[])?.id,site.id)
    assert.equal(nearestFieldwork(x,z,site.facing,[site.id]),null)
  }
  assert.equal(nearestFieldwork(-22,141,90,[]),null)
  assert.equal(compassGap(4,357),7)
})
test('three optional activity types reject wrong responses and accept valid readings',()=>{
  assert.equal(fieldReady('shore-crab','ridge-bird'),false)
  assert.equal(fieldReady('ridge-bird','ridge-bird'),true)
  assert.equal(fieldReady('photo-falls',''),false)
  assert.equal(fieldReady('photo-falls','5'),false)
  assert.equal(fieldReady('photo-falls','1'),true)
  assert.equal(fieldReady('photo-arch','1.4'),true)
  assert.equal(fieldReady('tide-reading','rising'),false)
  assert.equal(fieldReady('tide-reading','ebbing'),true)
  assert.ok(tideReading(0)>tideReading(1)&&tideReading(1)>tideReading(2))
})
test('old saves are accepted and field notes are validated without altering main progress',()=>{
  const legacy=emptyProgress()
  assert.deepEqual(decodeSave(JSON.stringify(legacy)),legacy)
  const newer=decodeSave(JSON.stringify({...legacy,fieldwork:['photo-arch','photo-arch','bogus','tide-reading']}))
  assert.deepEqual(newer?.fieldwork,['photo-arch','tide-reading'])
  assert.deepEqual(newer?.solved,[])
  assert.deepEqual(newer?.collected,[])
})
test('wet forest, dark eastern basalt and southern beach have different surface weights',()=>{
  assert.ok(biomeAt(-82,-6).wet>.95)
  assert.ok(biomeAt(174,-17).lava>.95)
  assert.ok(biomeAt(15,207).beach>.77)
  assert.ok(biomeAt(174,-17).wet<.04)
  assert.ok(height(-70,-156)>39)
  assert.ok(trailDistance(-38,123)>5)
})
