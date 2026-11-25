import type { Language } from './i18n.ts'
import type { Point } from './world-data.ts'

export type Bilingual=Record<Language,string>
export type FieldId='shore-crab'|'canopy-butterfly'|'ridge-bird'|'photo-falls'|'photo-arch'|'tide-reading'
type Site={
  id:FieldId;type:'species'|'photo'|'tide';point:Point;facing:number;radius:number;name:Bilingual;note:Bilingual
}
export const fieldSites:readonly Site[]=[
  {id:'shore-crab',type:'species',point:[37,197],facing:120,radius:4.8,name:{ro:'Crabul de stâncă',en:'Rock crab'},
    note:{ro:'Caută cleștii, carapacea joasă și deplasarea laterală printre pietrele plajei.',en:'Look for claws, a low shell and sideways motion among the beach rocks.'}},
  {id:'canopy-butterfly',type:'species',point:[-24,141],facing:331,radius:4.5,name:{ro:'Fluturele frunză',en:'Leafwing butterfly'},
    note:{ro:'În poiană urmărește perechea de aripi portocalii, cu margine întunecată.',en:'In the clearing, follow the paired amber wings with dark margins.'}},
  {id:'ridge-bird',type:'species',point:[-56,83],facing:300,radius:5.3,name:{ro:'Pasărea de pădure',en:'Forest bird'},
    note:{ro:'Pasărea stă la marginea coronamentului. Urmărește ciocul curbat și coada lungă.',en:'The bird perches at the canopy edge. Look for a curved bill and a long tail.'}},
  {id:'photo-falls',type:'photo',point:[-105,-52],facing:345,radius:4.4,name:{ro:'Fotografia cascadei',en:'Waterfall photograph'},
    note:{ro:'La trepied, aliniază cascada mare în reticul și declanșează.',en:'At the tripod, center the main waterfall in the reticle and release the shutter.'}},
  {id:'photo-arch',type:'photo',point:[8,-24],facing:348,radius:4.4,name:{ro:'Fotografia semaforului',en:'Semaphore photograph'},
    note:{ro:'Aliniază brațul semaforului cu centrul arcadei din mijloc.',en:'Align the semaphore arm above the center of the middle arch.'}},
  {id:'tide-reading',type:'tide',point:[211,31],facing:72,radius:5.4,name:{ro:'Măsurătoare de maree',en:'Tide reading'},
    note:{ro:'La jalonul de pe coastă, urmărește trei citiri succesive și determină direcția curentului.',en:'At the coastal gauge, watch three consecutive readings and determine the direction of the tide.'}},
]
export const fieldIds=fieldSites.map(site=>site.id)
export const fieldsByKind=[
  {type:'species',title:{ro:'Specii observate',en:'Species observed'}},
  {type:'photo',title:{ro:'Fotografii de teren',en:'Field photographs'}},
  {type:'tide',title:{ro:'Maree măsurată',en:'Tide measured'}},
] as const
export const compassGap=(a:number,b:number)=>((a-b+540)%360)-180
export function fieldReady(id:FieldId,value:string){
  if(id==='tide-reading')return value==='ebbing'
  if(id==='photo-falls'||id==='photo-arch'){
    const result=Number(value)
    return value.trim()!==''&&Number.isFinite(result)&&Math.abs(result-(id==='photo-falls'?0:1.4))<=1.4
  }
  return value===id
}
export function nearestFieldwork(x:number,z:number,heading:number,records:readonly FieldId[]){
  let closest:Site|null=null
  let distance=Infinity
  for(const site of fieldSites){
    if(records.includes(site.id))continue
    const dx=site.point[0]-x,dz=site.point[1]-z,d=Math.hypot(dx,dz)
    if(d>site.radius||d>=distance)continue
    const target=(Math.atan2(dx,-dz)*180/Math.PI+360)%360
    if(d>1.6&&Math.abs(compassGap(target,heading))>72)continue
    closest=site;distance=d
  }
  return closest
}
export function tideReading(index:number){
  return [1.34,1.26,1.15][Math.max(0,Math.min(index,2))]
}
