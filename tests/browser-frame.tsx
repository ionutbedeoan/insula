// Explicit UI integration harness for browsers that start without WebGL.
// It renders a top-down diagnostic view and runs the unchanged game controller.
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { PerspectiveCamera, Vector3 } from 'three'
import { Player, type PlayerCallbacks } from '../src/player.tsx'
import { surveyorAt } from '../src/surveyor.ts'
import { paths, scope } from '../src/world-data.ts'
import { scopeStop } from '../src/scope-optics.ts'
import type { Progress, Settings } from '../src/progress.ts'
import type { Runtime } from '../src/runtime.ts'

type State={camera:PerspectiveCamera;gl:{domElement:HTMLCanvasElement};clock:{elapsedTime:number}}
type Subscriber=(state:State,delta:number)=>void
const Engine=createContext<{state:State;subscribe:(fn:Subscriber)=>()=>void}|null>(null)
export function useThree(){return useContext(Engine)!.state}
export function useFrame(fn:Subscriber){
  const engine=useContext(Engine)!
  const callback=useRef(fn)
  callback.current=fn
  useLayoutEffect(()=>engine.subscribe((state,delta)=>callback.current(state,delta)),[engine])
}
function EngineProvider({surface,children,runtime,menu}:{
  surface:HTMLCanvasElement;children:ReactNode;runtime:RefObject<Runtime>;menu:boolean
}){
  const [engine]=useState(()=>{
    const state={camera:new PerspectiveCamera(71,1,.1,900),gl:{domElement:surface},clock:{elapsedTime:0}}
    const subscriptions=new Set<Subscriber>()
    return {state,subscriptions,subscribe:(fn:Subscriber)=>{subscriptions.add(fn);return ()=>{subscriptions.delete(fn)}}}
  })
  useEffect(()=>{
    let handle=0
    let previous=performance.now()
    const ctx=surface.getContext('2d')!
    let nextPaint=0
    const tick=(now:number)=>{
      const dt=Math.min(.05,(now-previous)/1000)
      previous=now
      engine.state.clock.elapsedTime+=dt
      runtime.current.npc=surveyorAt(runtime.current.elapsed)
      for(const fn of engine.subscriptions)fn(engine.state,dt)
      if(now>nextPaint){
        nextPaint=now+180
        const w=surface.clientWidth,h=surface.clientHeight
        if(surface.width!==w||surface.height!==h){surface.width=w;surface.height=h}
        ctx.fillStyle='#273f38';ctx.fillRect(0,0,w,h)
        ctx.fillStyle='#b6c6ad';ctx.font='13px system-ui';ctx.fillText('Browser integration test · 2D diagnostic frame',24,h-64)
        const camera=engine.state.camera
        camera.aspect=w/h;camera.updateProjectionMatrix()
        if(camera.fov===scopeStop.fov){
          surface.dataset.scopeFov=String(camera.fov)
          const centers=[]
          for(const {x,z,lampY} of scope.stations){
            const point=new Vector3(x,lampY,z).project(camera)
            centers.push(point.x.toFixed(3))
            if(point.z< -1||point.z>1)continue
            ctx.strokeStyle='#edb771'
            ctx.strokeRect((point.x+1)*w/2-13,(1-point.y)*h/2-7,26,14)
          }
          surface.dataset.scopeCenters=centers.join(',')
          handle=requestAnimationFrame(tick)
          return
        }
        surface.dataset.viewFov=String(camera.fov)
        delete surface.dataset.scopeFov
        delete surface.dataset.scopeCenters
        const ox=w/2,oy=h/2,scale=Math.min(w,h)/560
        ctx.lineWidth=1
        ctx.strokeStyle='#b7ac80'
        for(const path of paths){
          ctx.beginPath()
          path.forEach(([x,z],index)=>index===0?ctx.moveTo(ox+x*scale,oy+z*scale):ctx.lineTo(ox+x*scale,oy+z*scale))
          ctx.stroke()
        }
        if(!menu){
          const {x,z}=runtime.current.pose
          ctx.fillStyle='#ffe0a2';ctx.beginPath();ctx.arc(ox+x*scale,oy+z*scale,5,0,Math.PI*2);ctx.fill()
        }
      }
      handle=requestAnimationFrame(tick)
    }
    handle=requestAnimationFrame(tick)
    return ()=>cancelAnimationFrame(handle)
  },[engine,menu,runtime,surface])
  return <Engine.Provider value={engine}>{children}</Engine.Provider>
}
export function Scene({runtime,progress,settings,live,menu,callbacks,hud,onReady,scopeHeading}:{
  runtime:RefObject<Runtime>;progress:Progress;settings:Settings;live:boolean;menu:boolean;callbacks:PlayerCallbacks
  hud:RefObject<HTMLElement|null>;scopeHeading?:number;onReady:(surface:HTMLCanvasElement)=>void
}){
  const [surface,setSurface]=useState<HTMLCanvasElement|null>(null)
  const ready=useRef(onReady)
  ready.current=onReady
  useEffect(()=>{if(surface)ready.current(surface)},[surface])
  return <div className="island-canvas"><canvas ref={setSurface} style={{width:'100%',height:'100%'}}/>
    {surface&&<EngineProvider surface={surface} runtime={runtime} menu={menu}>
      <Player runtime={runtime} progress={progress} settings={settings} live={live} menu={menu} callbacks={callbacks} hud={hud} scopeHeading={scopeHeading}/>
    </EngineProvider>}
  </div>
}
