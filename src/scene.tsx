import { useRef, type RefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { AdaptiveDpr } from '@react-three/drei'
import { ACESFilmicToneMapping, DirectionalLight, Object3D, PCFShadowMap, SRGBColorSpace } from 'three'
import { DistantIslands, Gulls, Terrain } from './landscape.tsx'
import { translate } from './i18n.ts'
import { CoastalLight } from './coastal-light.tsx'
import { ForestFerns } from './fern-scan.tsx'
import { playNear } from './scope-optics.ts'
import { OpeningScenery } from './opening-scenery.tsx'
import { Habitats } from './habitats.tsx'
import { LivingWorld } from './living-world.tsx'
import { ExpeditionCharacters } from './character.tsx'
import { Player, type PlayerCallbacks } from './player.tsx'
import type { Progress, Settings } from './progress.ts'
import type { Runtime } from './runtime.ts'
import { Structures } from './structures.tsx'
import { Ocean, Sky } from './water.tsx'
import { Vegetation } from './vegetation.tsx'

export function Scene({runtime,progress,settings,live,menu,callbacks,hud,onReady,scopeHeading}:{
  runtime:RefObject<Runtime>;progress:Progress;settings:Settings;live:boolean;menu:boolean;callbacks:PlayerCallbacks
  hud:RefObject<HTMLElement|null>;scopeHeading?:number;onReady:(surface:HTMLCanvasElement)=>void
}){
  const high=settings.quality==='high'
  const mobile=settings.quality==='mobile'
  const low=mobile||settings.quality==='low'
  return <Canvas
    className="island-canvas" dpr={mobile?.64:low?.7:high?[1,1.65]:[.87,1.25]} shadows={low?false:{type:PCFShadowMap}}
    camera={{fov:settings.fov,near:playNear,far:960,position:[94,43,216]}}
    gl={{antialias:!low,alpha:false,powerPreference:'high-performance'}}
    fallback={<div className="webgl-fallback">{translate(settings.language,'This expedition needs WebGL 2. Enable hardware acceleration in your browser and reload.')}</div>}
    onCreated={({gl})=>{
      gl.outputColorSpace=SRGBColorSpace
      gl.toneMapping=ACESFilmicToneMapping
      gl.toneMappingExposure=1.14
      onReady(gl.domElement)
    }}>
    <fog attach="fog" args={['#95ada9',73,344]}/>
    <hemisphereLight args={['#bcd8dd','#766b55',1.23]}/>
    {!low&&<CoastalLight/>}
    <Sun high={high} low={low}/>
    <Sky/><DistantIslands/><Ocean low={low}/><Terrain low={low}/><Vegetation low={low} quality={settings.quality}/><Structures progress={progress} low={low}/>
    <Habitats low={low}/><OpeningScenery low={low}/>
    <ForestFerns low={low}/>
    <LivingWorld low={low}/>
    {!low&&<Gulls/>}
    {high&&<AdaptiveDpr/>}
    <ExpeditionCharacters runtime={runtime} menu={menu} third={settings.camera==='third'}/>
    <Player runtime={runtime} progress={progress} settings={settings} live={live} menu={menu} callbacks={callbacks} hud={hud} scopeHeading={scopeHeading}/>
  </Canvas>
}

function Sun({high,low}:{high:boolean;low:boolean}){
  const light=useRef<DirectionalLight>(null), target=useRef<Object3D>(null)
  const extent=high?71:47
  useFrame(({camera})=>{
    if(!light.current||!target.current)return
    const x=Math.round(camera.position.x/3)*3,z=Math.round(camera.position.z/3)*3,y=Math.round(camera.position.y/7)*7
    target.current.position.set(x,y,z)
    light.current.position.set(x-66,y+82,z-69)
    light.current.target=target.current
    target.current.updateMatrixWorld()
  })
  return <>
    <object3D ref={target}/>
    <directionalLight ref={light} position={[-66,82,-69]} color="#ffe5b5" intensity={2.81} castShadow={!low}
      shadow-mapSize-width={high?2048:1024} shadow-mapSize-height={high?2048:1024}
      shadow-camera-left={-extent} shadow-camera-right={extent} shadow-camera-top={extent} shadow-camera-bottom={-extent}
      shadow-camera-near={5} shadow-camera-far={286} shadow-normalBias={.072} shadow-bias={-.0002} shadow-radius={2}/>
  </>
}
