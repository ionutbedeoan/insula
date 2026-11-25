import { fieldIds, type FieldId } from './fieldwork.ts'
import { resolveLanguage, type Language } from './i18n.ts'
import { items, itemsById, puzzleIds, relics, secrets, views, type Item, type PuzzleId } from './content.ts'
import { placeIds, scope, spawn, type PlaceId } from './world-data.ts'
import { recoverSavedPosition } from './navigation.ts'

export type Pose = typeof spawn
export type Settings = { sensitivity:number; volume:number; quality:'low'|'medium'|'high'|'mobile'; fov:number; language:Language; camera:'first'|'third' }
export const defaultSettings: Settings = { sensitivity:1, volume:.48, quality:'high', fov:71, language:'ro', camera:'first' }
export type Progress = { version:1; pose:Pose; collected:string[]; discovered:PlaceId[]; solved:PuzzleId[]; elapsed:number; fieldwork?:FieldId[] }
export const emptyProgress = ():Progress => ({ version:1,pose:{...spawn},collected:[],discovered:[],solved:[],elapsed:0 })
export const saveKey = 'forgotten-island:expedition:v1'
export const settingsKey = 'forgotten-island:settings:v1'
export const has = (p:Progress,id:string) => p.collected.includes(id)
export const solved = (p:Progress,id:PuzzleId) => p.solved.includes(id)

const expected: Record<PuzzleId,string> = {
  lockbox:'472', relay:'air,sun,tide', repair:'lens,lamp', sight:String(scope.heading), bearing:'ESE', tide:'Ebb'
}
export function prerequisites(p:Progress,id:PuzzleId): string | undefined {
  if(id==='repair' && (!has(p,'lens') || !has(p,'lamp'))) return 'Recover the objective lens from camp and the indicator lamp by the falls.'
  if(id==='sight' && !solved(p,'repair')) return 'Fit the scope’s objective lens and indicator lamp first.'
  if(id==='sight' && !solved(p,'relay')) return 'The ranging boards are dark. Restore the semaphore relay at the ruins.'
  if(id==='bearing' && !solved(p,'sight')) return 'Confirm the coast landmark through the observation scope first.'
  if(id==='tide' && !solved(p,'bearing')) return 'Verify the bearing at the east survey slate first.'
  if(id==='tide' && !has(p,'keeper')) return 'Find the keeper’s tide record near the waterfall.'
}
export function answer(p:Progress,id:PuzzleId,value:string) {
  if(solved(p,id)) return { progress:p, message:'Already recorded in your journal.', correct:true }
  const blocked=prerequisites(p,id)
  if(blocked) return {progress:p,message:blocked,correct:false}
  const correct=id==='sight' ? Math.abs(Number(value)-scope.heading)<=1 && value.trim()!=='' : value===expected[id]
  return correct ? {progress:{...p,solved:[...p.solved,id]},message:'Recorded in your journal.',correct:true}
    : {progress:p,message:wrongAnswers[id],correct:false}
}
const wrongAnswers: Record<PuzzleId,string> = {
  lockbox:'The latch holds. Check the dispatch order and equipment roster.',
  relay:'The relay clicks twice and resets. Check the order in the keeper’s survey.',
  repair:'The fittings differ. Trace which component belongs in each slot.',
  sight:'The two markers need to overlap inside the central ring.',
  bearing:'That line misses the split rock. Check the keeper’s survey and the map.',
  tide:'The wheel springs back. Check which tide carries water out of the chamber.'
}
export const objectAvailable = (p:Progress,item:Item) =>
  (item.id!=='lens' || solved(p,'lockbox')) &&
  (item.area!=='archive' || solved(p,'tide')) &&
  (!['part','relic','view','secret'].includes(item.kind) || !has(p,item.id))

export function collect(p:Progress,item:Item):Progress {
  if(item.kind==='puzzle' || !objectAvailable(p,item) || has(p,item.id)) return p
  return {...p,collected:[...p.collected,item.id]}
}
export function discover(p:Progress,id:PlaceId):Progress {
  if(p.discovered.includes(id) || (id==='archive' && !solved(p,'tide'))) return p
  return {...p,discovered:[...p.discovered,id]}
}
export const objectives: { title:string; hint:string; touchHint?:string; showHintByDefault?:boolean; area:PlaceId; done:(p:Progress)=>boolean }[] = [
  { title:'Examine the abandoned skiff', hint:'Use WASD to reach the boat by the broken dock. Press E when prompted.', touchHint:'Hold an arrow to reach the boat by the broken dock. Tap the gold button when it lights up.', showHintByDefault:true, area:'beach', done:p=>has(p,'wreck') },
  { title:'Read the expedition landing log', hint:'Look for a folio on the low crate just inland from the skiff.', showHintByDefault:true, area:'beach', done:p=>has(p,'landing') },
  { title:'Find the expedition camp', hint:'Follow the trail through the palms. At the fork, turn left toward the orange tent. Check your map if you get lost.', showHintByDefault:true, area:'camp', done:p=>p.discovered.includes('camp') },
  { title:'Decode the survey lockbox', hint:'Read both the evacuation dispatch and the equipment roster. Enter the three numbers in dispatch order.', showHintByDefault:true, area:'camp', done:p=>solved(p,'lockbox') },
  { title:'Retrieve the scope lens', hint:'The padded compartment next to the lockbox is open.', area:'camp', done:p=>has(p,'lens') },
  { title:'Find the waterfall', hint:'Take the western trail north from camp. Watch for basalt and listen for rushing water.', area:'falls', done:p=>p.discovered.includes('falls') },
  { title:'Read the keeper’s survey', hint:'A clipboard rests on the south bank of the basin. Look for the orange-marked post.', area:'falls', done:p=>has(p,'keeper') },
  { title:'Restore the semaphore relay', hint:'The relief shows which symbol means air, sun and tide. The keeper recorded the correct order.', area:'ruins', done:p=>solved(p,'relay') },
  { title:'Reach the observation platform', hint:'The timber stairs begin on the tower’s south side. Read the operator’s card upstairs.', area:'tower', done:p=>has(p,'tower-log') },
  { title:'Repair and align the optical scope', hint:'Bring the lens from camp and the lamp from the western bank of the waterfall. Turn the repaired scope until both amber boards meet in its central ring.', area:'tower', done:p=>solved(p,'sight') },
  { title:'Locate and open the coastal archive', hint:'Check the slate east of the ruins. The keeper’s survey gives a compass bearing and the tide setting.', area:'coast', done:p=>solved(p,'tide') },
  { title:'Read the expedition’s final dispatch', hint:'Walk through the open door and look for the papers under the white desk lamp.', area:'archive', done:p=>has(p,'final') }
]
export const doneCount = (p:Progress) => objectives.filter(o=>o.done(p)).length
export const nextObjective = (p:Progress) => objectives.find(o=>!o.done(p))
export function completion(p:Progress) {
  const secondary=[...relics,...views,...secrets,itemsById['forest-note'],itemsById['coast-note'],itemsById['dispatch'],itemsById['roster'],itemsById['relief']]
  return Math.round(100*(doneCount(p)+secondary.filter(i=>has(p,i.id)).length)/(objectives.length+secondary.length))
}

function number(value:unknown,min:number,max:number,fallback:number) {
  return typeof value==='number' && Number.isFinite(value) && value>=min && value<=max ? value : fallback
}
function keys<T extends string>(value:unknown, allowed:readonly T[]):T[] {
  if(!Array.isArray(value)) return []
  return [...new Set(value.filter((item):item is T=>typeof item==='string' && allowed.includes(item as T)))]
}
export function decodeSave(raw:string|null):Progress|null {
  if(!raw) return null
  try {
    const data=JSON.parse(raw)
    if(data?.version!==1) return null
    const p=emptyProgress()
    p.collected=keys(data.collected,items.filter(i=>i.kind!=='puzzle').map(i=>i.id))
    p.discovered=keys(data.discovered,placeIds)
    const savedPuzzles=keys(data.solved,puzzleIds)
    for(const id of puzzleIds) {
      if(savedPuzzles.includes(id) && !prerequisites(p,id)) p.solved.push(id)
      if(id==='lockbox' && !solved(p,id)) p.collected=p.collected.filter(key=>key!=='lens')
    }
    if(!solved(p,'tide')){
      p.discovered=p.discovered.filter(id=>id!=='archive')
      p.collected=p.collected.filter(id=>itemsById[id].area!=='archive')
    }
    if(Array.isArray(data.fieldwork))p.fieldwork=keys(data.fieldwork,fieldIds)
    p.elapsed=number(data.elapsed,0,1e8,0)
    const x=number(data.pose?.x,-250,250,spawn.x), z=number(data.pose?.z,-250,250,spawn.z)
    const unsafeArchive=x>158 && x<178 && z>33 && z<43 && !solved(p,'tide')
    const safe=unsafeArchive?undefined:recoverSavedPosition(x,z,solved(p,'tide'))
    if(safe) p.pose={...safe,yaw:number(data.pose?.yaw,-Math.PI,Math.PI,spawn.yaw),pitch:number(data.pose?.pitch,-1.55,1.55,spawn.pitch)}
    return p
  } catch { return null }
}
export function readStorage(key:string) {
  try { return localStorage.getItem(key) } catch { return null }
}
export function writeStorage(key:string,value:object) {
  try { localStorage.setItem(key,JSON.stringify(value)); return true } catch { return false }
}
export function readSettings():Settings {
  try {
    const data=JSON.parse(readStorage(settingsKey) || '{}')
    return {
      language:resolveLanguage(data.language),
      camera:data.camera==='third'?'third':'first',
      sensitivity:number(data.sensitivity,.25,2.5,defaultSettings.sensitivity),
      volume:number(data.volume,0,1,defaultSettings.volume),
      fov:number(data.fov,55,93,defaultSettings.fov),
      quality:['low','medium','high','mobile'].includes(data.quality) ? data.quality : defaultSettings.quality
    }
  } catch { return {...defaultSettings} }
}
