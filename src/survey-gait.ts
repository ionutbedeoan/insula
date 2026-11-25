import { floor, smooth } from './world-data.ts'

const stride=1.35
const support=.60
const thigh=.448
const calf=.422

export function surveyFoot(distance:number,side:number,walking:boolean){
  if(!walking)return {forward:side===0?.045:-.054,lift:0}
  const phase=(distance/stride+side*.5)%1
  const reach=stride*support*.5
  if(phase<support)return {forward:reach-phase*stride,lift:0}
  const swing=(phase-support)/(1-support)
  return {forward:-reach+2*reach*smooth(0,1,swing),lift:Math.sin(swing*Math.PI)**1.25*.15}
}

export function surveyLeg(x:number,z:number,ground:number,yaw:number,distance:number,side:number,walking:boolean,hipHeight:number){
  const foot=surveyFoot(distance,side,walking)
  const lateral=side===0?-.11:.11
  const sampleX=x+Math.cos(yaw)*lateral-Math.sin(yaw)*foot.forward
  const sampleZ=z-Math.sin(yaw)*lateral-Math.cos(yaw)*foot.forward
  const elevation=floor(sampleX,sampleZ)-ground
  const down=hipHeight-(.145+foot.lift+elevation)
  const reach=Math.max(.19,Math.min(thigh+calf-.008,Math.hypot(down,foot.forward)))
  const knee=-Math.acos((reach*reach-thigh*thigh-calf*calf)/(2*thigh*calf))
  const hip=Math.atan2(foot.forward,down)-Math.atan2(calf*Math.sin(knee),thigh+calf*Math.cos(knee))
  return {hip,knee,foot:-hip-knee+(foot.lift>0?foot.lift*.48:0)}
}
