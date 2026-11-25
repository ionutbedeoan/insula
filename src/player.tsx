import { useEffect, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera, MathUtils, Vector3 } from 'three'
import type { Item } from './content.ts'
import { nearestFieldwork, type FieldId } from './fieldwork.ts'
import { compassPoints } from './i18n.ts'
import { shoreFollowCamera } from './surveyor.ts'
import { bestTarget } from './interaction.ts'
import { islandAudio } from './audio.ts'
import { solved, type Progress, type Settings } from './progress.ts'
import type { Runtime } from './runtime.ts'
import { archive, bearing, distance, floor, placeIds, places, spawn, type PlaceId } from './world-data.ts'
import { aimScope, playNear } from './scope-optics.ts'
import { canWalk, walk } from './navigation.ts'

export type PlayerCallbacks = {
  onPlace:(id:PlaceId)=>void
  onTarget:(item:Item|null)=>void
  onNpcNear:(near:boolean)=>void
  onField:(id:FieldId|null)=>void
  onHeartbeat:()=>void
  onCaptureExit:()=>void
}
export function Player({runtime,progress,settings,live,menu,callbacks,hud,scopeHeading}:{
  runtime:RefObject<Runtime>;progress:Progress;settings:Settings;live:boolean;menu:boolean;callbacks:PlayerCallbacks;hud:RefObject<HTMLElement|null>;scopeHeading?:number
}){
  const {camera,gl}=useThree()
  const aim=useRef(new Vector3())
  const held=useRef(new Set<string>())
  const input=useRef({vertical:0,jumping:false,wasSpace:false,yawMotion:0,pitchMotion:0,tick:0,heartbeat:0,npcNear:false,fieldTarget:null as FieldId|null,lookPointer:null as number|null,lastX:0,lastY:0})
  const active=useRef(live)
  active.current=live
  const control=useRef({settings,callbacks})
  control.current={settings,callbacks}

  useEffect(()=>{
    const surface=gl.domElement
    const keyDown=(event:KeyboardEvent)=>{
      if(!active.current || event.altKey || event.ctrlKey || event.metaKey) return
      if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight'].includes(event.code)){
        event.preventDefault()
        held.current.add(event.code)
      }
    }
    const keyUp=(event:KeyboardEvent)=>{held.current.delete(event.code)}
    const clear=()=>{held.current.clear();input.current.lookPointer=null}
    const lockChange=()=>{
      const locked=document.pointerLockElement===surface
      if(runtime.current.locked&&!locked&&active.current)control.current.callbacks.onCaptureExit()
      runtime.current.locked=locked
    }
    const ptrDown=(event:PointerEvent)=>{
      if(!active.current||event.button!==0||input.current.lookPointer!==null||document.pointerLockElement===surface)return
      input.current.lookPointer=event.pointerId
      input.current.lastX=event.clientX
      input.current.lastY=event.clientY
      if(event.pointerType==='touch')surface.setPointerCapture(event.pointerId)
    }
    const ptrUp=(event:PointerEvent)=>{if(input.current.lookPointer===event.pointerId)input.current.lookPointer=null}
    const ptrMove=(event:PointerEvent)=>{
      const sim=input.current
      const locked=document.pointerLockElement===surface
      if(!active.current||(sim.lookPointer!==event.pointerId&&!locked))return
      if(!locked && event.pointerType==='touch' && !surface.hasPointerCapture(event.pointerId))return
      const dx=locked?event.movementX:event.clientX-sim.lastX
      const dy=locked?event.movementY:event.clientY-sim.lastY
      sim.lastX=event.clientX
      sim.lastY=event.clientY
      sim.yawMotion-=dx*.00235*control.current.settings.sensitivity
      sim.pitchMotion-=dy*.00235*control.current.settings.sensitivity
    }
    window.addEventListener('keydown',keyDown)
    window.addEventListener('keyup',keyUp)
    window.addEventListener('blur',clear)
    surface.addEventListener('lostpointercapture',ptrUp)
    window.addEventListener('pointerup',ptrUp)
    window.addEventListener('pointercancel',ptrUp)
    document.addEventListener('pointerlockchange',lockChange)
    surface.addEventListener('pointerdown',ptrDown)
    document.addEventListener('pointermove',ptrMove)
    return ()=>{
      window.removeEventListener('keydown',keyDown)
      window.removeEventListener('keyup',keyUp)
      window.removeEventListener('blur',clear)
      surface.removeEventListener('lostpointercapture',ptrUp)
      window.removeEventListener('pointerup',ptrUp)
      window.removeEventListener('pointercancel',ptrUp)
      document.removeEventListener('pointerlockchange',lockChange)
      surface.removeEventListener('pointerdown',ptrDown)
      document.removeEventListener('pointermove',ptrMove)
    }
  },[gl,runtime])

  useEffect(()=>{
    held.current.clear()
    input.current.npcNear=false
    input.current.fieldTarget=null
    control.current.callbacks.onField(null)
    control.current.callbacks.onNpcNear(false)
    input.current.yawMotion=0
    input.current.pitchMotion=0
    input.current.lookPointer=null
  },[live])


  useFrame(({clock},dtRaw)=>{
    const dt=Math.min(dtRaw,.075)
    const sim=input.current
    const world=runtime.current
    const perspective=camera as PerspectiveCamera
    const fov=settings.fov-world.touchZoom
    if(scopeHeading!==undefined&&!menu){
      world.cameraDistance=0
      aimScope(perspective,scopeHeading)
      return
    }
    if(perspective.fov!==fov||perspective.near!==playNear){
      perspective.fov=fov
      perspective.near=playNear
      perspective.updateProjectionMatrix()
    }
    if(menu){
      const sway=Math.sin(clock.elapsedTime*.094)
      camera.position.set(94+sway*8,43+sway*2,216-sway*3)
      camera.lookAt(9,17,-61)
      islandAudio.update(20,193,0,false,false,false)
      return
    }
    const p=world.pose
    if(world.recover){
      world.pose={...spawn};world.y=floor(spawn.x,spawn.z);world.recover=false;sim.vertical=0;sim.jumping=false
      return
    }
    if(live){
      world.elapsed+=Math.min(dtRaw,.25)
      const keys=held.current
      const yawAxis=Number(keys.has('ArrowLeft'))-Number(keys.has('ArrowRight'))
      const pitchAxis=Number(keys.has('ArrowUp'))-Number(keys.has('ArrowDown'))
      p.yaw=Math.atan2(Math.sin(p.yaw+sim.yawMotion+yawAxis*dt*1.76),Math.cos(p.yaw+sim.yawMotion+yawAxis*dt*1.76))
      p.pitch=MathUtils.clamp(p.pitch+sim.pitchMotion+pitchAxis*dt*1.19,-1.48,1.48)
      sim.yawMotion=0;sim.pitchMotion=0
      const forward=Number(keys.has('KeyW'))-Number(keys.has('KeyS'))+world.touchMove.z
      const strafe=Number(keys.has('KeyD'))-Number(keys.has('KeyA'))+world.touchMove.x
      const mag=Math.hypot(forward,strafe)
      const run=keys.has('ShiftLeft')||keys.has('ShiftRight')
      const stride=(run?9.2:5.25)*dt/Math.max(1,mag)
      const dx=(Math.cos(p.yaw)*strafe-Math.sin(p.yaw)*forward)*stride
      const dz=(-Math.sin(p.yaw)*strafe-Math.cos(p.yaw)*forward)*stride
      const unlocked=solved(progress,'tide')
      const next=walk(p.x,p.z,dx,dz,unlocked,sim.jumping)
      p.x=next.x;p.z=next.z
      const targetY=floor(p.x,p.z)
      const jump=keys.has('Space')
      if(((jump&&!sim.wasSpace)||world.touchJump)&&!sim.jumping){sim.vertical=4.65;sim.jumping=true}
      world.touchJump=false
      sim.wasSpace=jump
      if(sim.jumping){
        sim.vertical-=dt*13.8
        world.y+=sim.vertical*dt
        if(world.y<=targetY&&sim.vertical<=0){world.y=targetY;sim.vertical=0;sim.jumping=false}
      }else{
        world.y= Math.abs(targetY-world.y)>.05 ? MathUtils.damp(world.y,targetY,18,dt) : targetY
      }
      sim.tick+=dt
      sim.heartbeat+=dtRaw
      if(sim.tick>.075){
        sim.tick=0
        islandAudio.update(p.x,p.z,p.yaw,mag>.1,run,true)
        for(const id of placeIds){
          const zone=places[id]
          if(!progress.discovered.includes(id)&&distance(p.x,p.z,zone.point)<zone.radius) {
            if(id==='archive'&&(!unlocked||p.x<archive.entryX+.8||Math.abs(p.z-archive.z)>4.1))continue
            callbacks.onPlace(id)
          }
        }
        const npcNear=Math.hypot(p.x-world.npc.x,p.z-world.npc.z)<7
        if(npcNear!==sim.npcNear){sim.npcNear=npcNear;callbacks.onNpcNear(npcNear)}
        const field=nearestFieldwork(p.x,p.z,bearing(p.yaw),progress.fieldwork??[])?.id??null
        if(field!==sim.fieldTarget){sim.fieldTarget=field;callbacks.onField(field)}
        const candidate=bestTarget(world,progress)
        if(candidate!==world.target){
          world.target=candidate
          callbacks.onTarget(candidate)
        }
        if(hud.current){
          const node=hud.current
          node.dataset.x=p.x.toFixed(2)
          node.dataset.z=p.z.toFixed(2)
          node.dataset.y=world.y.toFixed(2)
          node.dataset.heading=String(bearing(p.yaw))
          const readout=node.querySelector<HTMLElement>('b')
          if(readout){
            const b=bearing(p.yaw)
            readout.textContent=compassPoints(settings.language)[Math.round(b/45)%8]+'  '+String(b).padStart(3,'0')+'°'
          }
        }
      }
      if(sim.heartbeat>4){sim.heartbeat=0;callbacks.onHeartbeat()}
    }else{
      if(Math.abs(world.y-floor(p.x,p.z))>.18){world.y=floor(p.x,p.z);sim.jumping=false;sim.vertical=0}
      islandAudio.update(p.x,p.z,p.yaw,false,false,false)
    }
    if(settings.camera==='third'){
      const eye=world.y+1.6
      const follow=shoreFollowCamera(p.x,eye,p.z,p.yaw,p.pitch,solved(progress,'tide'))
      world.cameraDistance=follow.separation
      if(follow.separation>1){
        const side=Math.min(.62,follow.separation*.16)
        const cx=follow.x+Math.cos(p.yaw)*side,cz=follow.z-Math.sin(p.yaw)*side
        const moveShoulder=canWalk(cx,cz,solved(progress,'tide'))&&follow.y>floor(cx,cz)+.34
        camera.position.set(moveShoulder?cx:follow.x,follow.y,moveShoulder?cz:follow.z)
        aim.current.set(-Math.sin(p.yaw)*Math.cos(p.pitch),Math.sin(p.pitch),-Math.cos(p.yaw)*Math.cos(p.pitch))
        camera.lookAt(p.x+aim.current.x*14,eye+aim.current.y*14,p.z+aim.current.z*14)
        return
      }
    }
    world.cameraDistance=0
    camera.position.set(p.x,world.y+1.66,p.z)
    camera.rotation.set(p.pitch,p.yaw,0,'YXZ')
  })
  return null
}

