import { floor, lookYaw, type Point } from './world-data.ts'
import { canWalk } from './navigation.ts'

// Inès works along the old expedition route and stops to take measurements.
export const surveyStations = [
  {point:[24,195] as Point, wait:5, look:[17,190] as Point, label:'beach'},
  {point:[21.4,186] as Point,wait:0},
  {point:[21,182] as Point,wait:0},
  {point:[16,175] as Point,wait:0},
  {point:[2,159] as Point,wait:0},
  {point:[-18,137] as Point,wait:7,look:[-24,133] as Point,label:'forest'},
  {point:[-33,122] as Point,wait:0},
  {point:[-46,104] as Point,wait:0},
  {point:[-54,88] as Point,wait:0},
  {point:[-65.5,68.9] as Point,wait:12,look:[-70,60] as Point,label:'camp'},
  {point:[-54,88] as Point,wait:0},
  {point:[-46,104] as Point,wait:0},
  {point:[-29,118] as Point,wait:0},
  {point:[-12,145] as Point,wait:0},
  {point:[3,160] as Point,wait:0},
  {point:[21,176] as Point,wait:0},
  {point:[31,183.2] as Point,wait:8,look:[50,195] as Point,label:'coast'},
  {point:[37.6,184.1] as Point,wait:0},
  {point:[36.9,191.7] as Point,wait:0},
  {point:[35.5,196] as Point,wait:0},
] as const

const SPEED=1.58
const cycle=surveyStations.map((stop,index)=>{
  const next=surveyStations[(index+1)%surveyStations.length]
  const dx=next.point[0]-stop.point[0],dz=next.point[1]-stop.point[1]
  const distance=Math.hypot(dx,dz)
  return {stop,dx,dz,distance,heading:lookYaw(dx,dz),duration:stop.wait+distance/SPEED}
})
export const surveyCycle=cycle.reduce((sum,step)=>sum+step.duration,0)

export function surveyorAt(elapsed:number){
  let t=((elapsed%surveyCycle)+surveyCycle)%surveyCycle
  let distanceWalked=0
  for(const step of cycle){
    if(t>=step.duration){
      t-=step.duration;distanceWalked+=step.distance;continue
    }
    const idle=t<step.stop.wait
    const fraction=idle?0:(t-step.stop.wait)*SPEED/step.distance
    const x=step.stop.point[0]+step.dx*fraction,z=step.stop.point[1]+step.dz*fraction
    const yaw=idle&&'look' in step.stop?lookYaw(step.stop.look[0]-x,step.stop.look[1]-z):step.heading
    const station='label' in step.stop?step.stop.label:undefined
    const task=idle?(t>step.stop.wait-1.3?'look':station==='beach'?'measure':station==='forest'?'marker':station==='coast'?'look':'write'):undefined
    return {x,z,y:floor(x,z),yaw,walking:!idle,step:distanceWalked+fraction*step.distance,station,task,taskTime:idle?t:0}
  }
  return surveyorAt(0)
}
export type SurveyorPose=ReturnType<typeof surveyorAt>

export function shoreFollowCamera(x:number,y:number,z:number,yaw:number,pitch:number,unlocked:boolean){
  const distance=3.85
  const dx=Math.sin(yaw)*Math.cos(pitch)*distance
  const dz=Math.cos(yaw)*Math.cos(pitch)*distance
  const dy=.82-Math.sin(pitch)*distance
  let cx=x, cz=z, cy=y
  for(let sample=1;sample<=10;sample++){
    const t=sample/10
    const nextX=x+dx*t,nextZ=z+dz*t,nextY=y+dy*t
    if(!canWalk(nextX,nextZ,unlocked)||nextY<floor(nextX,nextZ)+.32)break
    cx=nextX;cy=nextY;cz=nextZ
  }
  return {x:cx,y:cy,z:cz,separation:Math.hypot(cx-x,cy-y,cz-z)}
}
