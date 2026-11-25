import { useEffect, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent, type RefObject } from 'react'
import { translate, type Language } from './i18n.ts'
import type { Runtime } from './runtime.ts'

const directions=[
  {id:'forward',glyph:'↑',label:'Forward',x:0,z:1},
  {id:'left',glyph:'←',label:'Left',x:-1,z:0},
  {id:'backward',glyph:'↓',label:'Backward',x:0,z:-1},
  {id:'right',glyph:'→',label:'Right',x:1,z:0},
] as const
export function touchDevice(){
  return typeof window!=='undefined' && window.matchMedia?.('(pointer: coarse)').matches===true
}

type Control={label:string;action:()=>void;glyph?:string;target?:string;pressed?:boolean}
function touchAction(action?:()=>void){
  return {
    onPointerUp:(event:PointerEvent<HTMLButtonElement>)=>{
      if(event.pointerType!=='touch')return
      const bounds=event.currentTarget.getBoundingClientRect()
      if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)return
      event.currentTarget.dataset.lastTouch=String(performance.now())
      action?.()
    },
    onClick:(event:ReactMouseEvent<HTMLButtonElement>)=>{
      const fromTouch=performance.now()-Number(event.currentTarget.dataset.lastTouch)<750
      if(event.detail===0||!fromTouch)action?.()
    },
  }
}
export function MobileControls({runtime,language,tools,interact,talk,field}:{
  runtime:RefObject<Runtime>;language:Language;tools:Control[];interact?:Control;talk?:Control;field?:Control
}){
  const t=(label:string)=>translate(language,label)
  const actionLabel=interact?.label??t('Move closer to interact')
  const pad=useRef<HTMLDivElement>(null)
  const pointers=useRef(new Map<number,typeof directions[number]>())
  const update=()=>{
    let x=0,z=0
    for(const key of new Set(pointers.current.values())){x+=key.x;z+=key.z}
    runtime.current.touchMove={x,z}
  }
  const release=(event:PointerEvent<HTMLButtonElement>)=>{
    if(!pointers.current.delete(event.pointerId))return
    if(!Array.from(pointers.current.values()).some(key=>key.id===event.currentTarget.dataset.key)){
      event.currentTarget.removeAttribute('data-held')
    }
    update()
  }
  useEffect(()=>{
    const reset=()=>{
      pointers.current.clear()
      pad.current?.querySelectorAll('[data-held]').forEach(button=>button.removeAttribute('data-held'))
      runtime.current.touchMove={x:0,z:0}
      runtime.current.touchJump=false
    }
    window.addEventListener('blur',reset)
    document.addEventListener('visibilitychange',reset)
    return ()=>{
      reset()
      window.removeEventListener('blur',reset)
      document.removeEventListener('visibilitychange',reset)
    }
  },[runtime])
  const zoom=(step:number)=>{
    const game=runtime.current
    game.touchZoom=Math.min(24,Math.max(0,game.touchZoom+step))
  }
  return <>
    <div ref={pad} className="touch-pad" aria-label={t('Movement pad')}>
      {directions.map(direction=><button key={direction.id} type="button" data-key={direction.id} aria-label={t(direction.label)}
        onPointerDown={event=>{
          if(event.button!==0||pointers.current.has(event.pointerId))return
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
          event.currentTarget.setAttribute('data-held','')
          pointers.current.set(event.pointerId,direction)
          update()
        }}
        onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
      >{direction.glyph}</button>)}
    </div>
    <div className="touch-actions">
      {talk&&<button type="button" {...touchAction(talk.action)}>{talk.label}</button>}
      {field&&<button type="button" {...touchAction(field.action)}>{field.label}</button>}
      <button type="button" className="touch-use" data-testid="touch-use" data-target={interact?.target} disabled={!interact}
        {...touchAction(interact?.action)}>{actionLabel}</button>
      <div className="touch-optics">
        <button type="button" aria-label={t('Zoom view in')} {...touchAction(()=>zoom(8))}>＋</button>
        <button type="button" aria-label={t('Zoom view out')} {...touchAction(()=>zoom(-8))}>−</button>
        <button type="button" aria-label={t('Jump action')} onPointerDown={()=>{runtime.current.touchJump=true}}
          onClick={event=>{if(event.detail===0)runtime.current.touchJump=true}}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 18V5m-5 5 5-5 5 5M6 20h12"/></svg></button>
      </div>
    </div>
    <nav className="touch-tools" aria-label={t('Controls')}>
      {tools.map(tool=><button type="button" key={tool.label} {...touchAction(tool.action)} aria-label={t(tool.label)} aria-pressed={tool.pressed}
        title={t(tool.label)}>{tool.glyph??t(tool.label)}</button>)}
    </nav>
  </>
}
