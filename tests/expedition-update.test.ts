import test from 'node:test'
import assert from 'node:assert/strict'
import { items, puzzleIds } from '../src/content.ts'
import { defaultLanguage, resolveLanguage, translate } from '../src/i18n.ts'
import { fieldCabins } from '../src/landmarks.ts'
import { clampMapPan, mapTransform } from '../src/map.tsx'
import { answer, emptyProgress, objectives, readSettings, settingsKey } from '../src/progress.ts'
import { localItem } from '../src/story-ro.ts'
import { shoreFollowCamera, surveyCycle, surveyorAt } from '../src/surveyor.ts'
import { floor, places } from '../src/world-data.ts'
import { canWalk } from '../src/navigation.ts'

test('new settings default to Romanian and high graphics, and valid saved settings are retained',()=>{
  assert.equal(defaultLanguage,'ro')
  assert.equal(resolveLanguage(undefined),'ro')
  assert.equal(resolveLanguage('unknown'),'ro')
  assert.equal(resolveLanguage('en'),'en')
  const previousStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage')
  const fake=(contents:unknown)=>Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>{
    assert.equal(key,settingsKey)
    return JSON.stringify(contents)
  }}})
  try{
    fake({})
    assert.equal(readSettings().quality,'high')
    fake({quality:'unknown'})
    assert.equal(readSettings().quality,'high')
    fake({quality:'mobile'})
    assert.equal(readSettings().quality,'mobile')
    fake({quality:'high',fov:82,volume:.35})
    assert.deepEqual(readSettings(),{quality:'high',fov:82,volume:.35,sensitivity:1,language:'ro',camera:'first'})
    fake({quality:'low',sensitivity:1.6,language:'en',camera:'third'})
    assert.equal(readSettings().quality,'low')
    assert.equal(readSettings().language,'en')
    assert.equal(readSettings().camera,'third')
  }finally{
    if(previousStorage)Object.defineProperty(globalThis,'localStorage',previousStorage)
    else Reflect.deleteProperty(globalThis,'localStorage')
  }
})

test('Romanian translations cover every location, journal item, objective, prerequisite and wrong-answer message',()=>{
  for(const item of items){
    const en=localItem(item,'en'),ro=localItem(item,'ro')
    assert.notEqual(ro.title,en.title,item.id+' title')
    if('text' in item)assert.notEqual(ro.text,en.text,item.id+' text')
  }
  for(const place of Object.values(places)){
    assert.notEqual(translate('ro',place.name),place.name)
    assert.notEqual(translate('ro',place.caption),place.caption)
  }
  for(const objective of objectives){
    assert.notEqual(translate('ro',objective.title),objective.title)
    assert.notEqual(translate('ro',objective.hint),objective.hint)
    if(objective.touchHint)assert.notEqual(translate('ro',objective.touchHint),objective.touchHint)
  }
  const ready={...emptyProgress(),collected:['lens','lamp','keeper'],solved:['lockbox','relay','repair','sight','bearing'] as typeof puzzleIds}
  for(const id of puzzleIds){
    const first=answer(emptyProgress(),id,'incorrect').message
    assert.notEqual(translate('ro',first),first)
    const unblocked=answer({...ready,solved:ready.solved.filter(puzzle=>puzzle!==id)},id,'incorrect').message
    assert.notEqual(translate('ro',unblocked),unblocked)
  }
})

test('Inès visits four stations, stays on walkable terrain and loops continuously',()=>{
  const stations=new Set<string>()
  assert.ok(!surveyorAt(0).walking)
  assert.ok(surveyorAt(7).walking)
  for(let t=0;t<surveyCycle;t+=.04){
    const stop=surveyorAt(t)
    assert.ok(canWalk(stop.x,stop.z,false),'NPC collided at '+t.toFixed(2))
    assert.equal(stop.y,floor(stop.x,stop.z))
    if(!stop.walking&&stop.station)stations.add(stop.station)
    if(t>.04){
      const previous=surveyorAt(t-.04)
      assert.ok(Math.hypot(stop.x-previous.x,stop.z-previous.z)<.067)
    }
  }
  assert.deepEqual([...stations],['beach','forest','camp','coast'])
  assert.deepEqual(surveyorAt(surveyCycle),surveyorAt(0))
})

test('the follow camera pulls forward near a closed barrier and each new cabin has a collision footprint',()=>{
  const open=shoreFollowCamera(154.4,8.7,38,Math.PI/2,0,true)
  const closed=shoreFollowCamera(154.4,8.7,38,Math.PI/2,0,false)
  assert.ok(closed.separation<open.separation)
  assert.ok(canWalk(closed.