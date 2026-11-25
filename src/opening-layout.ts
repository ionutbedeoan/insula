import { archive, shoreRadius, smooth } from './world-data.ts'

export const scanBeachRocks=[0,1,2,3,4,8] as const
export const scanForestLogs=[0,1] as const
export const openingStumps=[
  {x:-8,z:154,w:1.87,h:.63,d:1.84,yaw:.55},
  {x:-31,z:133,w:2.22,h:.74,d:1.94,yaw:2.48},
  {x:-52,z:102,w:1.61,h:.60,d:1.48,yaw:-.52},
  {x:-90,z:60,w:1.4,h:.51,d:1.51,yaw:1.4},
] as const
export const surfRocks=[
  {x:29,z:210.1,r:1.55,h:1.21,yaw:.14},
  {x:34.4,z:209,r:1.25,h:.85,yaw:.52},
  {x:44.7,z:202.4,r:2.1,h:1.31,yaw:2},
  {x:6.2,z:217.5,r:1.2,h:.91,yaw:-.5},
] as const
export const notchRocks=[
  {x:151.8,z:22.1,w:2.95,h:7.6,d:2.6,yaw:-.21},
  {x:155.9,z:22.6,w:3.25,h:6.8,d:2.8,yaw:.4},
] as const

// The archive sits inside the ridge. The scan's bottom meets the masonry roof.
export const archiveCapstones=[
  {x:163,z:31,w:14.9,h:9.5,d:6.4,yaw:1.9},
  {x:168,z:44.9,w:20,h:11.1,d:7.4,yaw:.27},
  {x:175,z:34.7,w:13.2,h:12.5,d:11,yaw:-.31},
  {x:168,z:36.2,w:19.9,h:6.4,d:11,yaw:2.73},
  {x:159,z:32,w:6.9,h:8.4,d:5,yaw:1.57},
  {x:180,z:40,w:10.9,h:9.6,d:10.9,yaw:.45},
].map(rock=>({...rock,y:archive.base+4.45+rock.h*.48}))

export const groundPlots=[
  {x:16.7,z:190, rx:7,rz:9,kind:'wrack'},
  {x:33.4,z:184, rx:4,rz:5,kind:'wrack'},
  {x:8.8,z:170, rx:9,rz:11,kind:'litter'},
  {x:-9,z:155, rx:8,rz:9,kind:'litter'},
  {x:-27,z:143,rx:10,rz:9,kind:'litter'},
  {x:-35,z:124,rx:10,rz:9,kind:'litter'},
  {x:-51,z:105,rx:10,rz:10,kind:'litter'},
  {x:-63,z:82, rx:8,rz:11,kind:'litter'},
  {x:-77,z:63, rx:10,rz:9,kind:'mud'},
  {x:-67,z:57, rx:6,rz:9,kind:'mud'},
  {x:-90,z:67, rx:6,rz:7,kind:'mud'},
] as const

export function shoreOffset(x:number,z:number){
  return Math.hypot(x,z)-shoreRadius(Math.atan2(z,x))+.43/.28
}

export function openingSoil(x:number,z:number){
  let litter=0,wrack=0,mud=0
  for(const plot of groundPlots){
    const border=1+.12*Math.sin(x*.8+z*.43)+.09*Math.sin(z*.97-x*.71)
    const radius=Math.hypot((x-plot.x)/plot.rx,(z-plot.z)/plot.rz)
    const blend=1-smooth(.13,border,radius)
    if(plot.kind==='litter')litter=Math.max(litter,blend)
    else if(plot.kind==='mud')mud=Math.max(mud,blend)
    else wrack=Math.max(wrack,blend)
  }
  return {litter,wrack,mud}
}

