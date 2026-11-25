import { fieldCabins } from './landmarks.ts'

export type Point = readonly [x: number, z: number]
export type PlaceId = 'beach' | 'forest' | 'camp' | 'falls' | 'ruins' | 'tower' | 'coast' | 'archive'
export const places = {
  beach: { name: 'Arrival Beach', point: [21, 189], radius: 26, caption: 'The expedition landing' },
  forest: { name: 'Palm Forest', point: [-20, 134], radius: 31, caption: 'Old cut through the palms' },
  camp: { name: 'Expedition Camp', point: [-69, 62], radius: 24, caption: 'Survey station · 1986' },
  falls: { name: 'Hidden Waterfall', point: [-109, -65], radius: 27, caption: 'Keeper’s water supply' },
  ruins: { name: 'Signal Ruins', point: [5, -38], radius: 28, caption: 'The 1893 tide semaphore' },
  tower: { name: 'Observation Tower', point: [78, -111], radius: 28, caption: 'Optical survey platform' },
  coast: { name: 'Rocky Coast', point: [140, 15], radius: 27, caption: 'The east shore transect' },
  archive: { name: 'Research Chamber', point: [169, 38], radius: 8, caption: 'Secure tidal archive' },
} satisfies Record<PlaceId, {name:string; point:Point; radius:number; caption:string}>
export const placeIds = Object.keys(places) as PlaceId[]
export const spawn = { x: 27, z: 201, yaw: 0.72, pitch: -0.035 }

export const paths: Point[][] = [
  [[23,194],[17,176],[1,159],[-20,134],[-40,113],[-54,88],[-67,67]],
  [[-67,67],[-67.4,58.5],[-68.1,55],[-72,54],[-81,42],[-86,13],[-91,-20],[-107,-45],[-110,-62]],
  [[-110,-62],[-87,-55],[-65,-44],[-39,-36],[-14,-32],[8,-29]],
  [[-69,62],[-51,43],[-28,30],[-10,12],[8,-29]],
  [[8,-29],[27,-52],[43,-73],[62,-91],[78,-98]],
  [[78,-98],[99,-83],[115,-62],[128,-39],[139,-10],[137,9],[145,25],[153,38],[175,38]],
  [[140,15],[124,39],[110,64],[102,93],[79,119],[54,152],[39,176],[23,194]],
  [[-20,134],[-38,145],[-61,140],[-76,124]],
  [[-109,-54],[-125,-54],[-132,-79],[-126,-94]],
  [[78,-98],[102,-105],[112,-128],[105,-156]],
  [[137,9],[150,-1],[165,-12],[186,-16]],
  [[-67,67],[-98,76],[-125,84],[-151,73]],
]

export const distance = (x: number, z: number, point: Point) => Math.hypot(x-point[0],z-point[1])
export function smooth(a: number, b: number, value: number) {
  const t = Math.min(1, Math.max(0, (value-a)/(b-a)))
  return t*t*(3-2*t)
}
export function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
}
const segments = paths.flatMap(path => path.slice(1).map(([bx,bz],i)=>{
  const [x,z]=path[i], dx=bx-x, dz=bz-z
  return {x,z,dx,dz,length:dx*dx+dz*dz}
}))
export function trailDistance(x: number,z: number) {
  let squared = Infinity
  for (const s of segments) {
    const t = Math.max(0,Math.min(1,((x-s.x)*s.dx+(z-s.z)*s.dz)/s.length))
    const dx = x-s.x-t*s.dx, dz = z-s.z-t*s.dz
    squared = Math.min(squared,dx*dx+dz*dz)
  }
  return Math.sqrt(squared)
}
export function shoreRadius(theta:number) {
  return 222 + 17*Math.sin(theta*3+.55) + 11*Math.cos(theta*5-.35) + 9*Math.sin(theta*8+.8)
}
export function shore(x: number,z: number) {
  return shoreRadius(Math.atan2(z,x)) - Math.hypot(x,z)
}
function hill(x:number,z:number,px:number,pz:number,rx:number,rz:number,amp:number) {
  return amp*Math.exp(-(((x-px)/rx)**2+((z-pz)/rz)**2))
}
const terraces: readonly [Point,number,number,number][] = [
  [[21,192],29,47,2.85], [[-20,134],15,29,9], [[-69,62],24,42,14],
  [[-108,-64],21,39,16], [[-125,-83],7,17,17], [[5,-38],27,49,22],
  [[78,-111],14,34,42], [[140,15],14,31,10], [[166,38],18,37,7],
  [[186,-16],7,20,6], [[105,-156],8,25,32]
]
export function height(x: number,z: number) {
  const edge=shore(x,z)
  if(edge<0) return Math.max(-17,edge*.26)
  let hills=7+hill(x,z,65,-104,82,78,34)+hill(x,z,-52,-105,47,76,35)
    +hill(x,z,-157,-35,28,82,20)+hill(x,z,-38,50,105,98,14)+hill(x,z,154,-17,32,30,12)
    +Math.sin(x*.108+z*.044)*1.4+Math.sin(z*.147-x*.053)*.9+Math.cos(x*.034-z*.073)*2
  // Keep the topographic trail shoulders and exposed headlands irregular.
  hills+=(Math.sin(x*.187+z*.077)*Math.sin(z*.149-x*.058)*.54+Math.cos(x*.294-z*.21)*.14)
  hills+=hill(x,z,-159,-48,17,56,5.9)+hill(x,z,161,-67,21,48,9.3)
  hills-=hill(x,z,-94,-34,13,45,4.2)
  hills+=hill(x,z,-70,-156,43,41,15.8)+hill(x,z,-150,-89,22,37,8.7)
  hills+=hill(x,z,169,-64,21,29,7.6)-hill(x,z,-119,-9,14,37,4.9)
  // Tight hollows flank the western trail. Preserve the survey paths and flats.
  if(x< -46&&z>-76&&z<44){
    const offTrail=smooth(3.5,13,trailDistance(x,z))
    hills+=(hill(x,z,-104,-9,25,35,5.0)-hill(x,z,-121,-5,12,47,5.6))*offTrail
  }
  for(const [point,inner,outer,target] of terraces){
    const blend=1-smooth(inner,outer,distance(x,z,point))
    hills+=(target-hills)*blend
  }
  return Math.min(edge*.28+smooth(10,59,edge)*39,hills)
}

export const tower = { x:78,z:-111,base:42,top:48.2,front:-103,stepStart:-96,halfWidth:1.55,back:-114.5 }
export const scope = {
  heading:151,
  origin:[78,49.32,-112] as const,
  stations:[
    {x:112.37,z:-50,lampY:34.41},
    {x:146.18,z:11,lampY:19.74},
  ]
}
export const archive = { x:166,z:38,entryX:158,backX:178,halfZ:4.5,base:7,landmark:[158,33.3] as Point }
export type Barrier = {x:number;z:number;w:number;d:number;gate?:true}
export const barriers: Barrier[] = [
  {x:17,z:190,w:1.85,d:3.2}, {x:33,z:188,w:1.7,d:1.3},
  {x:-78,z:61,w:4.7,d:3.5}, {x:-71,z:58,w:1.6,d:.85}, {x:-64,z:60,w:1.5,d:1},
  {x:-67,z:51,w:3,d:2.4}, {x:-111,z:-77,w:9.4,d:3.2}, {x:-108,z:-66,w:6.1,d:4.6},
  {x:5,z:-45,w:8.6,d:.9}, {x:-4,z:-39,w:.8,d:6.3},{x:14,z:-39,w:.8,d:6.3},
  {x:76,z:-111,w:.42,d:3.65},{x:80,z:-111,w:.42,d:3.65},
  {x:78,z:-114.35,w:2.25,d:.22},
  {x:archive.backX,z:38,w:.6,d:5.1}, {x:168,z:33.35,w:10.65,d:.68},
  {x:168,z:42.65,w:10.65,d:.68}, {x:158,z:34.5,w:.55,d:1.22},
  {x:158,z:41.5,w:.55,d:1.22}, {x:158,z:38,w:.65,d:2.3,gate:true},
  {x:172.5,z:35.5,w:2.4,d:.85},
  ...fieldCabins.map(cabin=>({x:cabin.x,z:cabin.z,w:cabin.w*.54,d:cabin.d*.55})),
]
export const lookYaw = (dx:number,dz:number) => Math.atan2(-dx,-dz)
export const bearing = (yaw: number) => ((Math.round(-yaw*180/Math.PI)%360)+360)%360

export function isGroundWalkable(x:number,z:number,unlocked:boolean) {
  if(shore(x,z)<4 || height(x,z)<.74) return false
  return !barriers.some(b=>!(b.gate && unlocked) && Math.abs(x-b.x)<b.w+.35 && Math.abs(z-b.z)<b.d+.35)
}

export function floor(x:number,z:number) {
  let y=height(x,z)
  const dx=Math.abs(x-tower.x)
  if(dx<tower.halfWidth+.14 && z<=tower.stepStart && z>=tower.front){
    const blend=(tower.stepStart-z)/(tower.stepStart-tower.front)
    y=Math.max(y,tower.base+(tower.top-tower.base)*blend)
  } else if(dx<2.28 && z<tower.front && z>=tower.back){
    y=Math.max(y,tower.top)
  }
  return y
}
