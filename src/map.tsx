import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { fieldSites } from './fieldwork.ts'
import { items, type Item } from './content.ts'
import { translate, type Language } from './i18n.ts'
import { has, solved, type Pose, type Progress } from './progress.ts'
import type { SurveyorPose } from './surveyor.ts'
import { archive, height, paths, placeIds, places, rng, shore } from './world-data.ts'

const sheetSize=720, scale=1.23
const coord=(value:number)=>sheetSize/2+value*scale
const positions=(x:number,z:number):[number,number]=>[coord(x),coord(z)]
const labelOffsets:Record<string,[number,number]>={
  beach:[10,19],forest:[9,14],camp:[-15,22],falls:[-8,-14],ruins:[9,-9],tower:[10,-13],coast:[9,-16],archive:[-28,25]
}
function traceShore(ctx:CanvasRenderingContext2D,offset=0){
  ctx.beginPath()
  for(let i=0;i<=360;i++){
    const a=i/360*Math.PI*2,x=Math.cos(a),z=Math.sin(a)
    const r=shore(x,z)+1-offset
    if(i===0)ctx.moveTo(...positions(x*r,z*r))
    else ctx.lineTo(...positions(x*r,z*r))
  }
  ctx.closePath()
}
function mark(ctx:CanvasRenderingContext2D,x:number,y:number,radius:number,color:string){
  ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fillStyle=color;ctx.fill()
}
function letter(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,color='#364237'){
  ctx.strokeStyle='#dad1aa';ctx.lineWidth=3.3;ctx.strokeText(text,x,y)
  ctx.fillStyle=color;ctx.fillText(text,x,y)
}

export function mapTransform(width:number, zoom:number, x:number, y:number){
  const ratio=width/sheetSize
  return {scale:ratio*zoom,x:ratio*(sheetSize*(1-zoom)/2+x),y:ratio*(sheetSize*(1-zoom)/2+y)}
}
export function clampMapPan(value:number,zoom:number){
  const limit=sheetSize*(zoom-1)/2
  return Math.max(-limit,Math.min(limit,value))
}

function createMap(){
  const canvas=document.createElement('canvas')
  canvas.width=canvas.height=sheetSize
  const ctx=canvas.getContext('2d')!
  const samplerSize=241, step=2.3
  const samples=Array.from({length:samplerSize},(_,j)=>Float32Array.from({length:samplerSize},(_,i)=>height((i-120)*step,(j-120)*step)))
  const shade=ctx.createLinearGradient(0,0,sheetSize,sheetSize)
  shade.addColorStop(0,'#7e9e96');shade.addColorStop(1,'#a4b6a3')
  ctx.fillStyle=shade;ctx.fillRect(0,0,sheetSize,sheetSize)
  for(let i=0;i<7;i++){traceShore(ctx,-4-i*6);ctx.lineWidth=.8;ctx.strokeStyle='rgba(34,78,72,.28)';ctx.stroke()}
  traceShore(ctx)
  ctx.fillStyle='#c7bc8f';ctx.fill()
  ctx.save();traceShore(ctx);ctx.clip()
  for(let j=1;j<samplerSize-1;j++)for(let i=1;i<samplerSize-1;i++){
    const y=samples[j][i]
    if(y<.75)continue
    const s=(samples[j-1][i-1]-samples[j+1][i+1])*.11
    const a=1-Math.min(1,y/46)
    const shadeValue=Math.max(-13,Math.min(13,s*20))
    ctx.fillStyle='rgb('+Math.round(155+a*52+shadeValue)+' '+Math.round(161+a*36+shadeValue)+' '+Math.round(113+a*21+shadeValue)+')'
    ctx.fillRect(...positions((i-120)*step,(j-120)*step),step*scale+.63,step*scale+.63)
  }
  for(let level=5;level<=55;level+=5){
    ctx.beginPath()
    for(let j=0;j<samplerSize-1;j++)for(let i=0;i<samplerSize-1;i++){
      const a0=samples[j][i],a1=samples[j][i+1],a2=samples[j+1][i+1],a3=samples[j+1][i]
      if(Math.min(a0,a1,a2,a3)>level||Math.max(a0,a1,a2,a3)<level)continue
      const h=[samples[j][i],samples[j][i+1],samples[j+1][i+1],samples[j+1][i]]
      const corners=[[i,j],[i+1,j],[i+1,j+1],[i,j+1]]
      const hits:[number,number][]=[]
      for(let side=0;side<4;side++){
        const next=(side+1)%4
        if((h[side]>=level)===(h[next]>=level))continue
        const t=(level-h[side])/(h[next]-h[side]),[ax,ay]=corners[side],[bx,by]=corners[next]
        hits.push(positions((ax+(bx-ax)*t-120)*step,(ay+(by-ay)*t-120)*step))
      }
      if(hits.length>=2){
        ctx.moveTo(...hits[0]);ctx.lineTo(...hits[1])
        if(hits.length===4){ctx.moveTo(...hits[2]);ctx.lineTo(...hits[3])}
      }
    }
    ctx.strokeStyle=level%10===0?'#54564066':'#555b4541'; ctx.lineWidth=level%10===0?1.1:.65;ctx.stroke()
  }
  const random=rng(391)
  for(let i=0;i<1550;i++){
    const x=(random()-.5)*500,z=(random()-.5)*500
    if(shore(x,z)<20||height(x,z)<10)continue
    const [sx,sy]=positions(x,z), l=2+random()*2.6
    ctx.strokeStyle='#49624653';ctx.lineWidth=.63;ctx.beginPath()
    ctx.moveTo(sx-l*.55,sy+l*.35);ctx.lineTo(sx,sy-l*.54);ctx.lineTo(sx+l*.55,sy+l*.35);ctx.stroke()
  }
  ctx.restore()
  traceShore(ctx);ctx.strokeStyle='#394f46';ctx.lineWidth=1.5;ctx.stroke()
  const grid=61.5
  ctx.strokeStyle='#384f4330';ctx.lineWidth=.65
  for(let i=360%grid;i<sheetSize;i+=grid){
    ctx.beginPath();ctx.moveTo(i,13);ctx.lineTo(i,707);ctx.moveTo(13,i);ctx.lineTo(707,i);ctx.stroke()
  }
  ctx.strokeStyle='#31493e77';ctx.lineWidth=1
  ctx.strokeRect(8,8,sheetSize-16,sheetSize-16)
  return canvas
}
let base:HTMLCanvasElement|undefined

export function IslandMap({progress,pose,npc,heading,language='ro',compact=false}:{
  progress:Progress;pose?:Pose;npc?:SurveyorPose;heading?:number;language?:Language;compact?:boolean
}){
  const canvas=useRef<HTMLCanvasElement>(null)
  const drag=useRef<{id:number;x:number;y:number}|null>(null)
  const [camera,setCamera]=useState({zoom:1,x:0,y:0})
  const t=(value:string)=>translate(language,value)
  function setZoom(zoom:number){
    setCamera(current=>{
      zoom=Math.min(3.25,Math.max(1,zoom))
      return {zoom,x:clampMapPan(current.x*zoom/current.zoom,zoom),y:clampMapPan(current.y*zoom/current.zoom,zoom)}
    })
  }
  function move(e:PointerEvent<HTMLCanvasElement>){
    const current=drag.current
    if(!current||current.id!==e.pointerId)return
    const ratio=sheetSize/e.currentTarget.getBoundingClientRect().width
    const x=(e.clientX-current.x)*ratio,y=(e.clientY-current.y)*ratio
    current.x=e.clientX;current.y=e.clientY
    setCamera(view=>({...view,x:clampMapPan(view.x+x,view.zoom),y:clampMapPan(view.y+y,view.zoom)}))
  }
  useEffect(()=>{
    const element=canvas.current
    if(!element||compact)return
    const wheel=(event:WheelEvent)=>{
      event.preventDefault()
      setCamera(current=>{
        const zoom=Math.min(3.25,Math.max(1,current.zoom*(event.deltaY<0?1.13:.885)))
        const box=element.getBoundingClientRect()
        const x=(event.clientX-box.left)/box.width*sheetSize-sheetSize/2
        const y=(event.clientY-box.top)/box.height*sheetSize-sheetSize/2
        const delta=zoom/current.zoom
        return {zoom,x:clampMapPan(x-(x-current.x)*delta,zoom),y:clampMapPan(y-(y-current.y)*delta,zoom)}
      })
    }
    element.addEventListener('wheel',wheel,{passive:false})
    return ()=>element.removeEventListener('wheel',wheel)
  },[compact])
  useEffect(()=>{
    const ctx=canvas.current?.getContext('2d')
    if(!ctx)return
    base??=createMap()
    const {scale:k,x:offsetX,y:offsetY}=mapTransform(sheetSize,camera.zoom,camera.x,camera.y)
    ctx.resetTransform()
    ctx.setTransform(k,0,0,k,offsetX,offsetY)
    ctx.drawImage(base,0,0)
    ctx.strokeStyle='#6b583c';ctx.lineWidth=1.35/k;ctx.setLineDash([3.5/k,3.3/k])
    paths.forEach((path,i)=>{
      if(i>=7)return
      const points=i===5&&!solved(progress,'bearing')?path.slice(0,7):path
      ctx.beginPath();ctx.moveTo(...positions(...points[0]))
      for(const point of points.slice(1))ctx.lineTo(...positions(...point))
      ctx.stroke()
    })
    ctx.setLineDash([])
    ctx.resetTransform()
    const onMap=(x:number,z:number):[number,number]=>[coord(x)*k+offsetX,coord(z)*k+offsetY]
    ctx.font=compact?'bold 19px Georgia':'bold 14px Georgia'
    for(const id of placeIds){
      if(!progress.discovered.includes(id))continue
      if(compact&&!['coast','ruins','tower'].includes(id))continue
      const [x,y]=onMap(...places[id].point),[dx,dy]=labelOffsets[id]
      mark(ctx,x,y,5,'#ebdcb3');mark(ctx,x,y,2.9,'#3d5548')
      letter(ctx,translate(language,places[id].name),x+dx,y+dy)
    }
    if(!compact){
      for(const item of items.filter(i=>['secret','view'].includes(i.kind)&&has(progress,i.id))){
        const [x,y]=onMap(item.x,item.z)
        mark(ctx,x,y,4.6,'#e4d4a6');mark(ctx,x,y,2.85,item.kind==='secret'?'#9b5d36':'#527b68')
      }
      if(pose)for(const site of fieldSites){
        const recorded=progress.fieldwork?.includes(site.id)
        const [x,z]=site.point
        if(!recorded&&Math.hypot(pose.x-x,pose.z-z)>95)continue
        const [mx,my]=onMap(x,z)
        ctx.save();ctx.translate(mx,my);ctx.rotate(Math.PI*.25)
        ctx.fillStyle=recorded?'#466951':'#ab724d';ctx.strokeStyle='#e4dfb7';ctx.lineWidth=1.6
        ctx.fillRect(-3.8,-3.8,7.6,7.6);ctx.strokeRect(-3.8,-3.8,7.6,7.6);ctx.restore()
      }
      if(pose&&npc&&Math.hypot(pose.x-npc.x,pose.z-npc.z)<96){
        const [x,y]=onMap(npc.x,npc.z)
        mark(ctx,x,y,6.3,'#e6cc97');mark(ctx,x,y,4,'#925835')
        letter(ctx,'Inès',x+8,y-8,'#684226')
      }
    }
    if(heading!==undefined){
      const [x,y]=onMap(121,18),a=heading*Math.PI/180
      ctx.setLineDash([6,5]);ctx.strokeStyle='#98452b';ctx.lineWidth=2.65
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.sin(a)*156,y-Math.cos(a)*156);ctx.stroke()
      ctx.setLineDash([]);mark(ctx,x,y,5.4,'#98452b')
    }
    if(solved(progress,'bearing')||compact){
      const [x,y]=onMap(...archive.landmark)
      ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.fillStyle='#945f3a';ctx.fillRect(-4,-4,8,8);ctx.restore()
    }
    if(pose){
      const [x,y]=onMap(pose.x,pose.z)
      ctx.save();ctx.translate(x,y);ctx.rotate(-pose.yaw);ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(7,7);ctx.lineTo(0,3);ctx.lineTo(-7,7);ctx.closePath()
      ctx.fillStyle='#23493e';ctx.strokeStyle='#fff0ce';ctx.lineWidth=2;ctx.stroke();ctx.fill();ctx.restore()
    }
    if(!compact){
      ctx.fillStyle='#c7c4a4ea';ctx.fillRect(18,634,169,67);ctx.fillRect(646,624,55,77)
      ctx.strokeStyle='#39473a';ctx.lineWidth=1
      ctx.beginPath();ctx.moveTo(674,647);ctx.lineTo(674,689);ctx.moveTo(653,672);ctx.lineTo(695,672);ctx.stroke()
      ctx.beginPath();ctx.moveTo(674,648);ctx.lineTo(667,670);ctx.lineTo(674,665);ctx.lineTo(681,670);ctx.closePath();ctx.fillStyle='#33483d';ctx.fill()
      ctx.font='bold 13px system-ui';ctx.fillText('N',669,645)
      const bar=50*scale*camera.zoom
      const metres=bar>128?25:50
      const length=metres*scale*camera.zoom
      ctx.beginPath();ctx.moveTo(29,667);ctx.lineTo(29+length,667);ctx.moveTo(29,662);ctx.lineTo(29,672);ctx.moveTo(29+length,662);ctx.lineTo(29+length,672);ctx.stroke()
      ctx.fillText(metres+' m',29,687)
    }
  },[camera,compact,heading,language,npc,pose,progress])
  const map=<canvas ref={canvas} className="field-map" width={sheetSize} height={sheetSize}
    aria-label={t('Field map of the island. North is up.')}
    onPointerDown={e=>{if(!compact&&camera.zoom>1&&!drag.current&&e.button===0){e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:e.pointerId,x:e.clientX,y:e.clientY}}}}
    onPointerMove={move} onLostPointerCapture={event=>{if(drag.current?.id===event.pointerId)drag.current=null}} />
  if(compact)return map
  return <div className="map-chart" data-zoom={camera.zoom.toFixed(2)}>{map}<div className="map-tools">
    <button onClick={()=>setZoom(camera.zoom/1.3)} aria-label={t('Zoom out')} disabled={camera.zoom<=1}>−</button>
    <button onClick={()=>setZoom(camera.zoom*1.3)} aria-label={t('Zoom in')} disabled={camera.zoom>=3.25}>+</button>
    <button onClick={()=>setCamera({zoom:1,x:0,y:0})} aria-label={t('Center map')}>⌖</button>
  </div></div>
}

export function formatTime(seconds:number){
  const value=Math.floor(seconds)
  return Math.floor(value/60)+'m '+String(value%60).padStart(2,'0')+'s'
}
export function artifactGlyph(item:Item){
  if(item.id==='lamp')return '✶'
  if(item.id==='lens'||item.id==='compass')return '⊙'
  if(item.kind==='relic')return '◇'
  if(item.kind==='view')return '◬'
  if(item.kind==='secret')return '⌖'
  return '▤'
}
