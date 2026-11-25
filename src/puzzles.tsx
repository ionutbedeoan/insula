import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { PuzzleId } from './content.ts'
import { prerequisites, solved, type Progress } from './progress.ts'
import { IslandMap } from './map.tsx'
import { translate, type Language } from './i18n.ts'
import { scope } from './world-data.ts'
import { scopeStop } from './scope-optics.ts'

type Submit=(value:string)=>boolean
type Copy=(english:string)=>string
const labels:Record<PuzzleId,string>={lockbox:'Combination lock',relay:'Semaphore sequence',repair:'Optical assembly',sight:'Sighting test',bearing:'Bearing check',tide:'Tidal counterweight'}
const descriptions:Record<PuzzleId,string>={
  lockbox:'Three indexed wheels secure the expedition case.',
  relay:'The sequence wakes the ranging boards on the southeast slope.',
  repair:'Fit the recovered components to the matching sockets.',
  sight:'Find the bearing at which both amber boards overlap inside the reticle.',
  bearing:'From the scarlet survey origin, project a compass bearing toward the split rock.',
  tide:'Set the wheel to take pressure off the archive’s lower hinges.'
}
const hints:Record<PuzzleId,string[]>={
  lockbox:['Two records are on the tables in camp.','Read the dispatch left to right and replace each word with its instrument number.','WIND is 4, BELL is 7, SUN is 2.'],
  relay:['The keeper’s survey by the falls describes a weather sequence.','Match the weather words to engravings on the stone relief beside the relay.','Use △ air, ○ sun, ≋ tide.'],
  repair:['Retrieve the lens from the survey case and the lamp west of the falls.','The round optical element belongs in the wide front collar. The lamp goes in the small reticle socket.'],
  sight:['The operator card points southeast. Move the dial slowly.','Both amber boards and the rock notch meet at about '+scope.heading+'°.'],
  bearing:['The keeper’s waterfall survey gives a direction from the east slate.','Select ESE to point across the cliff shoulder toward the archive.'],
  tide:['Read the keeper’s survey and the instructions pinned outside the archive.','Outgoing water is the ebb.']
}
export function Puzzle({id,progress,language,onSubmit,onClose,onJournal,onScope,touch=false}:{id:PuzzleId;progress:Progress;language:Language;onSubmit:(value:string)=>{correct:boolean;message:string};onClose:()=>void;onJournal:()=>void;onScope?:(heading:number)=>void;touch?:boolean}){
  const t=(english:string)=>translate(language,english)
  const [message,setMessage]=useState('')
  const [hint,setHint]=useState(0)
  const blocked=prerequisites(progress,id)
  const done=solved(progress,id)
  const surveying=id==='sight'&&!done&&!blocked
  useEffect(()=>{if(surveying)onScope?.(scopeStop.initial)},[surveying,onScope])
  const submit:Submit=value=>{const result=onSubmit(value);setMessage(result.message);return result.correct}
  return <>
    <div className="puzzle-title"><span className="eyebrow">{t(labels[id])}</span><p>{t(descriptions[id])}</p></div>
    {done ? <div className="confirmed" role="status"><span aria-hidden="true">✓</span>{t(id==='tide'?'The door is open. The archive lies ahead.':'Completed. The result is in your field journal.')}</div> : blocked?
      <p className="puzzle-blocked" role="status">{t(blocked)}</p> :
      <>
        {id==='lockbox'&&<Lockbox t={t} submit={submit} touch={touch}/>}
        {id==='relay'&&<Relay t={t} submit={submit}/>}
        {id==='repair'&&<Repair t={t} submit={submit}/>}
        {id==='sight'&&<Sight t={t} submit={submit} onScope={onScope}/>}
        {id==='bearing'&&<Bearing language={language} t={t} submit={submit} progress={progress}/>}
        {id==='tide'&&<Tide t={t} language={language} submit={submit}/>}
      </>
    }
    {!done&&message&&<p className="puzzle-message" role="status">{t(message)}</p>}
    {!done&&hint>0&&<p className="hint-box">{id==='sight'&&hint===2&&language==='ro'?'Cele două panouri și crestătura se aliniază la aproximativ '+scope.heading+'°.':t(hints[id][hint-1])}</p>}
    <div className="panel-actions">
      <button className="text-button" onClick={onClose}>{t(done?'Return to the island':'Close mechanism')}</button>
      {!done&&<button className="text-button" onClick={onJournal}>{t('Journal')} <kbd>J</kbd></button>}
      {!done&&<button className="text-button" onClick={()=>setHint(value=>Math.min(value+1,hints[id].length))}>{t(hint?'Next hint':'Show hint')}</button>}
    </div>
  </>
}
function Lockbox({submit,t,touch}:{submit:Submit;t:Copy;touch:boolean}){
  const [code,setCode]=useState('')
  const check=(event:FormEvent)=>{event.preventDefault();if(code.length===3)submit(code)}
  return <form className="lockbox" onSubmit={check}>
    <div className="code-frame">{[0,1,2].map(i=><span key={i}>{code[i]??'–'}</span>)}</div>
    <label className="code-entry">{t('Three-digit code')}
      <input aria-label={t('Three-digit code')} readOnly={touch} inputMode={touch?'none':'numeric'} autoComplete="off" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,3))} />
    </label>
    {touch&&<div className="touch-keypad">
      {[1,2,3,4,5,6,7,8,9,0].map(digit=><button key={digit} type="button" onClick={()=>setCode(value=>(value+digit).slice(0,3))}>{digit}</button>)}
      <button type="button" onClick={()=>setCode(value=>value.slice(0,-1))} aria-label={t('Delete digit')}>⌫</button>
    </div>}
    <button className="button primary" disabled={code.length!==3}>{t('Turn latch')}</button>
  </form>
}
const signals=[{id:'air',glyph:'△',name:'Rising air'},{id:'sun',glyph:'○',name:'Full sun'},{id:'tide',glyph:'≋',name:'Falling tide'},{id:'bell',glyph:'◇',name:'Signal bell'}]
function Relay({submit,t}:{submit:Submit;t:Copy}){
  const [order,setOrder]=useState<string[]>([])
  return <>
    <div className="signal-sequence" aria-label={t('Selected sequence')}>{[0,1,2].map(i=><span key={i}>{signals.find(s=>s.id===order[i])?.glyph??'·'}</span>)}</div>
    <div className="signal-grid">{signals.map(s=><button key={s.id} aria-label={t(s.name)} onClick={()=>setOrder(value=>value.length>=3?[s.id]:[...value,s.id])}><span>{s.glyph}</span>{t(s.name)}</button>)}</div>
    <div className="puzzle-commit"><button className="text-button" onClick={()=>setOrder([])}>{t('Clear sequence')}</button><button className="button primary" disabled={order.length!==3} onClick={()=>{if(!submit(order.join(',')))setOrder([])}}>{t('Engage relay')}</button></div>
  </>
}
function Repair({submit,t}:{submit:Submit;t:Copy}){
  const [part,select]=useState('')
  const [sockets,assign]=useState(['',''])
  const names:Record<string,string>={lens:'Objective lens',lamp:'Indicator lamp'}
  return <>
    <div className="puzzle-choice">{['lens','lamp'].map(id=><button className={part===id?'chosen':''} key={id} onClick={()=>select(id)} aria-pressed={part===id}>{t(names[id])}</button>)}</div>
    <div className="socket-grid">{['Wide front collar','Reticle socket'].map((name,i)=><button key={name} onClick={()=>{if(!part)return;assign(sockets.map((entry,index)=>index===i?part:entry===part?'':entry));select('')}}>
      <b>{t(name)}</b><span>{t(names[sockets[i]]??'Empty socket')}</span>
    </button>)}</div>
    <div className="puzzle-commit"><button className="text-button" onClick={()=>{assign(['','']);select('')}}>{t('Remove parts')}</button><button className="button primary" disabled={!sockets.every(Boolean)} onClick={()=>submit(sockets.join(','))}>{t('Test assembly')}</button></div>
  </>
}
function Sight({submit,t,onScope}:{submit:Submit;t:Copy;onScope?:(heading:number)=>void}){
  const [heading,setHeading]=useState<number>(scopeStop.initial)
  const touchConfirmed=useRef(-Infinity)
  const drag=useRef<{pointer:number;x:number;heading:number}|null>(null)
  const setBearing=(value:number)=>{
    const next=Math.min(scopeStop.max,Math.max(scopeStop.min,Math.round(value)))
    setHeading(next);onScope?.(next)
  }
  return <>
    <div className="scope-window" aria-label={t('Scope view with two amber ranging boards and a rocky notch')}
      onPointerDown={e=>{if(e.button!==0||drag.current)return;drag.current={pointer:e.pointerId,x:e.clientX,heading};e.currentTarget.setPointerCapture(e.pointerId)}}
      onPointerMove={e=>{const start=drag.current;if(start?.pointer===e.pointerId)setBearing(start.heading+(start.x-e.clientX)*.23)}}
      onLostPointerCapture={event=>{if(drag.current?.pointer===event.pointerId)drag.current=null}}>
      <svg viewBox="0 0 100 100" className="scope-reticle" aria-hidden="true">
        <circle cx="50" cy="50" r="42"/><circle cx="50" cy="50" r="10"/>
        <path d="M8 50h32m20 0h32M50 8v32m0 20v32M47 50h6m-3-3v6"/>
      </svg>
      <span className="scope-drag">{t('Drag the lens to turn the scope')}</span>
    </div>
    <label className="dial-label">{t('Scope bearing')} <output>{heading}°</output><input aria-label={t('Scope bearing')} type="range" min={scopeStop.min} max={scopeStop.max} value={heading} onChange={e=>setBearing(e.target.valueAsNumber)} /></label>
    <div className="puzzle-commit"><button className="button primary" onPointerUp={event=>{
      if(event.pointerType!=='touch')return
      const bounds=event.currentTarget.getBoundingClientRect()
      if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)return
      touchConfirmed.current=performance.now()
      submit(String(heading))
    }} onClick={event=>{
      if(event.detail===0||performance.now()-touchConfirmed.current>750)submit(String(heading))
    }}>{t('Confirm alignment')}</button></div>
  </>
}
const bearings=[['ENE',67.5],['E',90],['ESE',112.5],['SSE',157.5]] as const
function Bearing({progress,submit,t,language}:{progress:Progress;submit:Submit;t:Copy;language:Language}){
  const [selected,setSelected]=useState<(typeof bearings)[number]|null>(null)
  return <>
    <div className="bearing-map"><IslandMap progress={progress} language={language} heading={selected?.[1]} compact/></div>
    <div className="puzzle-choice bearing-choices">{bearings.map(entry=><button key={entry[0]} className={selected===entry?'chosen':''} aria-pressed={selected===entry} onClick={()=>setSelected(entry)}>{entry[0]}</button>)}</div>
    <div className="puzzle-commit"><button className="button primary" disabled={!selected} onClick={()=>{if(selected)submit(selected[0])}}>{t('Record bearing')}</button></div>
  </>
}
function Tide({submit,t,language}:{submit:Submit;t:Copy;language:Language}){
  const [phase,setPhase]=useState('')
  return <>
    <div className="tide-cycle">{[['Flood','↗'],['High','∧'],['Ebb','↘'],['Slack','—']].map(([name,glyph])=>
      <button className={phase===name?'chosen':''} key={name} onClick={()=>setPhase(name)} aria-pressed={phase===name}><span>{glyph}</span>{t(name==='High'&&language==='ro'?'High tide':name)}</button>)}</div>
    <div className="puzzle-commit"><button className="button primary" disabled={!phase} onClick={()=>submit(phase)}>{t('Set tide wheel')}</button></div>
  </>
}
