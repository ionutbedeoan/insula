import type { Item } from './content.ts'
import type { Pose } from './progress.ts'
import { surveyorAt, type SurveyorPose } from './surveyor.ts'
import { floor, spawn } from './world-data.ts'

export type Runtime = {
  pose:Pose
  y:number
  target:Item|null
  locked:boolean
  touchMove:{x:number;z:number}
  touchJump:boolean
  touchZoom:number
  recover:boolean
  elapsed:number
  npc:SurveyorPose
  cameraDistance:number
}
export function makeRuntime(pose=spawn,elapsed=0):Runtime {
  return {pose:{...pose},y:floor(pose.x,pose.z),target:null,locked:false,touchMove:{x:0,z:0},touchJump:false,touchZoom:0,recover:false,elapsed,npc:surveyorAt(elapsed),cameraDistance:0}
}
