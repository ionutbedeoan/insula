import { MathUtils, PerspectiveCamera } from 'three'
import { scope } from './world-data.ts'

export const playNear=.12
export const scopeStop={min:110,max:195,initial:127,fov:12,near:6.25} as const
export const scopePitch=Math.atan2(scope.stations[0].lampY-scope.origin[1],
  Math.hypot(scope.stations[0].x-scope.origin[0],scope.stations[0].z-scope.origin[2]))

export function aimScope(camera:PerspectiveCamera,heading:number){
  if(camera.fov!==scopeStop.fov||camera.near!==scopeStop.near){
    camera.fov=scopeStop.fov
    camera.near=scopeStop.near
    camera.updateProjectionMatrix()
  }
  const azimuth=MathUtils.degToRad(heading)
  const clearance=1.55
  camera.position.set(
    scope.origin[0]+Math.sin(azimuth)*Math.cos(scopePitch)*clearance,
    scope.origin[1]+Math.sin(scopePitch)*clearance,
    scope.origin[2]-Math.cos(azimuth)*Math.cos(scopePitch)*clearance,
  )
  camera.rotation.set(scopePitch,-azimuth,0,'YXZ')
  camera.updateMatrixWorld()
}
