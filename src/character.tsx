import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as T from 'three'
import type { Runtime } from './runtime.ts'
import { islandMaterial } from './island-materials.ts'
import { ExpeditionFace } from './face.tsx'
import { surveyLeg } from './survey-gait.ts'
import { surveyorAt, type SurveyorPose } from './surveyor.ts'

const skin=new T.MeshStandardMaterial({color:'#ba8362',roughness:.78})
const hair=new T.MeshStandardMaterial({color:'#30241e',roughness:.94})
const leather=new T.MeshStandardMaterial({color:'#483428',roughness:.86})
const strap=new T.MeshStandardMaterial({color:'#605346',roughness:.93})
const seams=new T.MeshStandardMaterial({color:'#b19b7d',roughness:.97})
const pants=new T.MeshStandardMaterial({color:'#55594b',roughness:.93})
const button=new T.MeshStandardMaterial({color:'#8a8c76',metalness:.35,roughness:.6})
const canvas=new T.MeshStandardMaterial({color:'#756957',roughness:1})
const paper=new T.MeshStandardMaterial({color:'#b7aa82',roughness:1})
const shadow=(()=>{
  const size=64, data=new Uint8Array(size*size*4)
  for(let z=0;z<size;z++)for(let x=0;x<size;x++){
    const i=(z*size+x)*4, radius=Math.hypot((x+.5)/32-1,(z+.5)/32-1)
    data[i]=21;data[i+1]=25;data[i+2]=20;data[i+3]=Math.max(0,1-radius)**1.7*175
  }
  const tex=new T.DataTexture(data,size,size)
  tex.needsUpdate=true
  return new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2})
})()
const sphere=new T.SphereGeometry(1,18,13)
const sphereSmall=new T.SphereGeometry(1,12,8)
const box=new T.BoxGeometry()
const cylinder=new T.CylinderGeometry(1,1,1,16)
const coatBody=new T.LatheGeometry([[0,.935],[.168,.94],[.185,.966],[.188,1.025],[.185,1.10],[.195,1.19],[.205,1.29],[.222,1.37],[.21,1.415],[.15,1.473],[.085,1.483],[0,1.49]].map(([x,y])=>new T.Vector2(x,y)),30)
coatBody.scale(1,1,.70)
const seamMetal=new T.MeshStandardMaterial({color:'#aa9576',roughness:.38,metalness:.55})
const stitch=new T.MeshStandardMaterial({color:'#bfac90',roughness:1})
const rubber=new T.MeshStandardMaterial({color:'#272a25',roughness:.99})

function Shape({position,scale,material,form=sphere,rotation}:{
  position:[number,number,number];scale:[number,number,number];material:T.Material;form?:T.BufferGeometry;rotation?:[number,number,number]
}){
  return <mesh geometry={form} material={material} position={position} scale={scale} rotation={rotation} castShadow receiveShadow />
}

function useRig(){
  return {
    root:useRef<T.Group>(null), body:useRef<T.Group>(null), head:useRef<T.Group>(null),
    legs:useRef<T.Group[]>([]),knees:useRef<T.Group[]>([]),feet:useRef<T.Group[]>([]),
    arms:useRef<T.Group[]>([]),elbows:useRef<T.Group[]>([]),notebook:useRef<T.Group>(null), pencil:useRef<T.Mesh>(null)
  }
}
type Rig=ReturnType<typeof useRig>
function Human({rig,player}:{rig:Rig;player:boolean}){
  const coat=useMemo(()=>islandMaterial('fabric',{color:player?'#595e45':'#89938a',roughness:.93}),[player])
  const knit=useMemo(()=>islandMaterial('fabric',{color:player?'#7c7257':'#635244',roughness:1}),[player])
  return <group ref={rig.root}>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,.012,0]} material={shadow} scale={[1.15,.8,1]}><planeGeometry/></mesh>
    <group ref={rig.body}>
      <Shape position={[0,.99,.02]} scale={[.17,.19,.109]} material={pants}/>
      <mesh geometry={coatBody} material={coat} position={[0,0,.012]} castShadow receiveShadow/>
      <Shape position={[0,1.029,-.126]} scale={[.339,.039,.018]} material={knit} form={box}/>
      <Shape position={[0,1.425,-.132]} scale={[.15,.053,.022]} material={knit} form={box}/>
      <Shape position={[0,1.373,-.1]} scale={[.127,.062,.038]} material={knit}/>
      <Shape position={[0,1.175,-.139]} scale={[.016,.39,.013]} material={seams} form={box}/>
      <Shape position={[0,1.027,-.09]} scale={[.30,.037,.083]} material={leather} form={box}/>
      <Shape position={[.005,1.027,-.14]} scale={[.055,.041,.024]} material={button} form={box}/>
      {[1.105,1.196,1.287].map(y=><Shape key={y} position={[.006,y,-.153]} scale={[.009,.009,.006]} material={button} form={sphereSmall}/>)}
      {[-1,1].map((side,i)=><group key={side}>
        <Shape position={[side*.125,1.29,-.116]} scale={[.056,.048,.033]} material={knit}/>
        {[0,1,2,3].map(index=><Shape key={index} position={[side*(.073+index*.031),1.254,-.143]} scale={[.011,.0025,.004]} material={stitch} form={box}/>)}
        <Shape position={[side*.168,1.176,-.108]} scale={[.038,.064,.018]} material={strap} form={box}/>
        <Shape position={[side*.115,1.191,-.162]} scale={[.03,.028,.013]} material={seamMetal} form={box}/>
        <Shape position={[side*.126,1.324,-.132]} scale={[.091,.017,.019]} material={coat} form={box}/>
        <Shape position={[side*.116,1.258,-.147]} scale={[.036,.321,.015]} material={strap} form={box} rotation={[0,0,-side*.10]}/>
        <group position={[side*.11,1.01,.005]} ref={n=>{if(n)rig.legs.current[i]=n}}>
          <Shape position={[0,-.219,.002]} scale={[.099,.288,.094]} material={pants}/>
          <group position={[0,-.448,0]} ref={n=>{if(n)rig.knees.current[i]=n}}>
            <Shape position={[0,-.13,.005]} scale={[.074,.229,.073]} material={pants}/>
            <group position={[0,-.422,0]} ref={n=>{if(n)rig.feet.current[i]=n}}>
              <Shape position={[0,.054,-.048]} scale={[.078,.075,.147]} material={leather}/>
              <Shape position={[0,.02,-.056]} scale={[.143,.035,.25]} material={rubber} form={box}/>
              <Shape position={[0,.108,.009]} scale={[.074,.100,.084]} material={leather}/>
              {[0,1,2].map(index=><Shape key={index} position={[0,.111+index*.008,-.112+index*.018]} scale={[.071,.006,.005]} material={stitch} form={box}/>)}
              <Shape position={[0,.104,-.062]} scale={[.077,.047,.028]} material={strap}/>
            </group>
          </group>
        </group>
        <group position={[side*.235,1.398,.008]} ref={n=>{if(n)rig.arms.current[i]=n}}>
          <Shape position={[0,-.118,0]} scale={[.085,.19,.082]} material={coat}/>
          <group position={[0,-.283,0]} ref={n=>{if(n)rig.elbows.current[i]=n}}>
            <Shape position={[0,-.09,0]} scale={[.068,.168,.068]} material={coat}/>
            <Shape position={[0,-.209,0]} scale={[.067,.051,.066]} material={knit}/>
            <Shape position={[0,-.267,-.003]} scale={[.046,.076,.051]} material={skin}/>
            <Shape position={[-side*.033,-.251,-.025]} scale={[.026,.047,.026]} material={skin} form={sphereSmall}/>
            {!player&&i===1&&<mesh ref={rig.pencil} geometry={cylinder} material={seams} position={[-.022,-.29,-.043]} scale={[.005,.13,.005]} rotation={[.73,0,.21]}/>}
          </group>
        </group>
      </group>)}
      <Shape position={[0,1.273,.151]} scale={[.174,.236,.10]} material={canvas}/>
      <Shape position={[0,1.386,.184]} scale={[.172,.084,.103]} material={strap}/>
      {[0,1,2].map(index=><Shape key={index} position={[(index-1)*.085,1.39,.265]} scale={[.041,.015,.018]} material={seamMetal} form={box}/>)}
      <Shape position={[0,1.62,.152]} scale={[.15,.038,.046]} material={strap} form={box}/>
      <Shape position={[0,1.195,.239]} scale={[.126,.082,.049]} material={knit}/>
      {[-1,1].map(side=><Shape key={side} position={[side*.166,1.271,.195]} scale={[.027,.351,.045]} material={strap} form={box}/>)}
      <Shape position={[.173,1.124,.199]} scale={[.044,.105,.048]} material={button} form={cylinder}/>
      <Shape position={[0,1.487,.007]} scale={[.074,.101,.073]} material={skin}/>
      <Shape position={[0,1.466,-.007]} scale={[.093,.042,.080]} material={knit}/>
      <group ref={rig.head} position={[0,1.625,-.006]}>
        <ExpeditionFace player={player}/>
        <Shape position={[0,.054,.028]} scale={[.113,.104,.11]} material={hair}/>
        {!player&&<Shape position={[.008,-.055,.091]} scale={[.073,.084,.073]} material={hair}/>}
        <Shape position={[0,.105,.005]} scale={[.136,.072,.126]} material={knit}/>
        <Shape position={[0,.083,-.069]} scale={[.158,.015,.168]} material={knit}/>
      </group>
      {!player&&<group position={[0,1.213,-.275]} rotation={[.43,0,0]} ref={rig.notebook}>
        <Shape position={[0,0,0]} scale={[.223,.026,.153]} material={leather} form={box}/>
        <Shape position={[0,.016,-.006]} scale={[.201,.011,.137]} material={paper} form={box}/>
        <Shape position={[0,.027,-.004]} scale={[.01,.007,.125]} material={seams} form={box}/>
      </group>}
    </group>
  </group>
}
function gait(rig:Rig,time:number,speed:number,writing:boolean,dt:number){
  const wave=Math.sin(time),amplitude=Math.min(1,speed/1.6), idle=writing?1:0
  if(rig.body.current){
    rig.body.current.position.y=-.15-.022*amplitude+.024*(1-Math.cos(time*2))*amplitude
    rig.body.current.rotation.y=.095*wave*amplitude
    rig.body.current.rotation.z=.038*wave*amplitude
  }
  if(rig.head.current){
    rig.head.current.rotation.x=T.MathUtils.damp(rig.head.current.rotation.x,idle*.38+(1-idle)*.04*Math.sin(time),7,dt)
    rig.head.current.rotation.y=idle*.11*Math.sin(time*.23)
  }
  if(rig.notebook.current)rig.notebook.current.visible=writing
  for(let i=0;i<2;i++){
    const phase=time+i*Math.PI, f=Math.sin(phase), direction=i===0?-1:1
    const [leg,knee,foot,arm,elbow]=[rig.legs.current[i],rig.knees.current[i],rig.feet.current[i],rig.arms.current[i],rig.elbows.current[i]]
    if(!leg||!knee||!foot||!arm||!elbow)continue
    leg.rotation.x=T.MathUtils.damp(leg.rotation.x,f*.59*amplitude,14,dt)
    knee.rotation.x=T.MathUtils.damp(knee.rotation.x,-Math.max(0,-f+.04)*.83*amplitude,14,dt)
    foot.rotation.x=T.MathUtils.damp(foot.rotation.x,-leg.rotation.x*.53-knee.rotation.x*.37,13,dt)
    arm.rotation.x=T.MathUtils.damp(arm.rotation.x,-f*.49*amplitude+idle*(.47+direction*.065),12,dt)
    arm.rotation.z=T.MathUtils.damp(arm.rotation.z,direction*(idle?-.29:.12),9,dt)
    elbow.rotation.x=T.MathUtils.damp(elbow.rotation.x,.14+amplitude*.23+idle*.63,11,dt)
  }
}

function surveyMotion(rig:Rig,pose:SurveyorPose,yaw:number,dt:number){
  const blend=(from:number,to:number,rate=12)=>T.MathUtils.damp(from,to,rate,dt)
  const frame=pose.step/1.35*Math.PI*2
  const swing=pose.walking?Math.sin(frame):0
  const writing=pose.task==='write'||pose.task==='measure'
  const marking=pose.task==='marker'
  const looking=pose.task==='look'
  const bend=(marking?.21:pose.task==='measure'?.12:writing?.055:0)
  const drop=marking?.19:pose.task==='measure'?.17:.155
  const hipHeight=1.01+(rig.body.current?.position.y??-drop)
  if(rig.body.current){
    const body=rig.body.current
    body.position.y=blend(body.position.y,-drop+(pose.walking?.013*(1-Math.cos(2*frame)):0),15)
    body.rotation.x=blend(body.rotation.x,-bend,9)
    body.rotation.z=blend(body.rotation.z,.023*swing,9)
    body.rotation.y=blend(body.rotation.y,.07*swing+(marking?.14:0),9)
  }
  if(rig.head.current){
    const {rotation}=rig.head.current
    rotation.x=blend(rotation.x,writing?-.28:marking?-.19:looking?.06:.025*Math.sin(frame),8)
    rotation.y=blend(rotation.y,looking?Math.sin(pose.taskTime*1.18)*.39:marking?-.22:.025*swing,8)
  }
  if(rig.notebook.current){
    rig.notebook.current.visible=writing
    rig.notebook.current.position.z=pose.task==='measure'?-.35:-.275
  }
  if(rig.pencil.current)rig.pencil.current.visible=pose.task==='write'
  for(let i=0;i<2;i++){
    const leg=rig.legs.current[i],knee=rig.knees.current[i],foot=rig.feet.current[i]
    const arm=rig.arms.current[i],elbow=rig.elbows.current[i]
    if(!leg||!knee||!foot||!arm||!elbow)continue
    const joints=surveyLeg(pose.x,pose.z,pose.y,yaw,pose.step,i,pose.walking,hipHeight)
    const settle=pose.walking?38:16
    leg.rotation.x=blend(leg.rotation.x,joints.hip,settle)
    knee.rotation.x=blend(knee.rotation.x,joints.knee,settle)
    foot.rotation.x=blend(foot.rotation.x,joints.foot,settle)
    const side=i===0?-1:1
    const reach=marking&&i===1?.83:writing?.43:-side*swing*.31
    arm.rotation.x=blend(arm.rotation.x,reach,10)
    arm.rotation.z=blend(arm.rotation.z,side*(writing?-.25:.10),10)
    elbow.rotation.x=blend(elbow.rotation.x,writing?.93+(i===1?.09*Math.sin(pose.taskTime*8):0):marking?.39:.19,10)
  }
}

export function ExpeditionCharacters({runtime,menu,third}:{runtime:RefObject<Runtime>;menu:boolean;third:boolean}){
  const npc=useRig(),avatar=useRig()
  const anchor=useRef({x:0,z:0,phase:0,yaw:0})
  useFrame(({clock},raw)=>{
    const dt=Math.min(raw,.065)
    const state=runtime.current
    const pose=surveyorAt(menu?clock.elapsedTime:state.elapsed)
    state.npc=pose
    if(npc.root.current){
      npc.root.current.position.set(pose.x,pose.y,pose.z)
      const yaw=npc.root.current.rotation.y
      const turn=Math.atan2(Math.sin(pose.yaw-yaw),Math.cos(pose.yaw-yaw))
      npc.root.current.rotation.y=yaw+turn*Math.min(1,dt*6)
      surveyMotion(npc,pose,npc.root.current.rotation.y,dt)
    }
    if(!avatar.root.current)return
    avatar.root.current.visible=!menu&&third&&state.cameraDistance>1
    const {x,z,yaw}=state.pose
    const old=anchor.current
    const dist=Math.hypot(x-old.x,z-old.z)
    const speed=dist>4||!dt?0:dist/dt
    old.x=x;old.z=z;old.phase+=Math.min(dist,.5)*5.5
    const turn=Math.atan2(Math.sin(yaw-old.yaw),Math.cos(yaw-old.yaw))
    old.yaw+=turn*Math.min(1,dt*9)
    avatar.root.current.position.set(x,state.y,z)
    avatar.root.current.rotation.y=old.yaw
    gait(avatar,old.phase,speed,false,dt)
  })
  return <><Human rig={npc} player={false}/><Human rig={avatar} player/></>
}
