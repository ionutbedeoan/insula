import { BufferAttribute, BufferGeometry } from 'three'
import { shoreRadius, smooth } from './world-data.ts'

export const seaLevel=.43
const waveBands=[
  {x:.236,z:.192,speed:1.28,amplitude:.245},
  {x:-.31,z:.174,speed:1.38,amplitude:.128},
  {x:.61,z:-.359,speed:2.10,amplitude:.064},
] as const

export function shoreWavePhase(x:number,z:number,offset:number,time:number){
  return offset*1.16+time*1.61+Math.sin(x*.083+z*.106)*.81+Math.sin(x*.277-z*.149)*.24
}
export function seaDisplacement(x:number,z:number,offset:number,time:number){
  const swell=waveBands.reduce((value,band)=>value+band.amplitude*Math.sin(x*band.x+z*band.z-time*band.speed),0)
  const surf=Math.max(0,Math.sin(shoreWavePhase(x,z,offset,time)))**3
  return swell*(.29+.71*smooth(0,14,offset))+.31*surf*(1-smooth(2,20,offset))
}

const gl=(value:number)=>value.toFixed(4)
// The optical and contact effects use the same phase as the shoreline mesh.
export const shoreFoamGLSL=`
float coastDistance(vec2 p){
  float theta=atan(p.y,p.x);
  float radius=222.+17.*sin(theta*3.+.55)+11.*cos(theta*5.-.35)+9.*sin(theta*8.+.8);
  return length(p)-radius+.43/.28;
}`
export const seaWavesGLSL=`
float shoreWavePhase(vec2 p,float offset,float time){
  return offset*1.16+time*1.61+sin(dot(p,vec2(.083,.106)))*.81+sin(dot(p,vec2(.277,-.149)))*.24;
}
float seaDisplacement(vec2 p,float offset,float time){
  float swell=${waveBands.map(band=>`${gl(band.amplitude)}*sin(dot(p,vec2(${gl(band.x)},${gl(band.z)}))-time*${gl(band.speed)})`).join(' + ')};
  float surf=pow(max(0.,sin(shoreWavePhase(p,offset,time))),3.);
  return swell*(.29+.71*smoothstep(0.,14.,offset))+.31*surf*(1.-smoothstep(2.,20.,offset));
}`

export function makeSeaSurface(low:boolean){
  // Fine concentric strips follow the coastline. Far sections widen in calm water.
  const sectors=low?320:568
  const offsets:number[]=[]
  const interval=low?1.42:.79
  for(let offset=-8;offset<33;offset+=interval)offsets.push(offset)
  offsets.push(33,35,37,40,44,49,55,63,73,87,105,128,155,190,235,292,370,466,594,770,950)
  const positions=new Float32Array(offsets.length*(sectors+1)*3)
  const shoreOffsets=new Float32Array(positions.length/3)
  const indices=[]
  for(let sector=0;sector<=sectors;sector++){
    const angle=sector%sectors/sectors*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle)
    const center=shoreRadius(angle)-seaLevel/.28
    for(let row=0;row<offsets.length;row++){
      const index=sector*offsets.length+row,distance=center+offsets[row]
      positions.set([distance*c,seaLevel,distance*s],index*3)
      shoreOffsets[index]=offsets[row]
      if(sector<sectors&&row+1<offsets.length){
        const next=index+offsets.length
        indices.push(index,next,index+1,index+1,next,next+1)
      }
    }
  }
  const geometry=new BufferGeometry()
  geometry.setAttribute('position',new BufferAttribute(positions,3))
  geometry.setAttribute('shoreOffset',new BufferAttribute(shoreOffsets,1))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  return geometry
}
