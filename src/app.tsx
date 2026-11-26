import { Component, useCallback, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import { translate, resolveLanguage } from './i18n.ts'
import { localItem } from './story-ro.ts'
import { FieldPanel } from './field-panel.tsx'
import { fieldSites, nearestFieldwork, type FieldId } from './fieldwork.ts'
import { islandAudio } from './audio.ts'
import { items, relics, secrets, views, type Item } from './content.ts'
import { artifactGlyph, formatTime, IslandMap } from './map.tsx'
import {
  answer, collect, completion, decodeSave, discover, doneCount, emptyProgress, has, nextObjective, objectAvailable, objectives, prerequisites, solved,
  readSettings, readStorage, saveKey, settingsKey, writeStorage, type Progress, type Settings
} from './progress.ts'
import { ArchiveCharts, ChartExhibit } from './archive-charts.tsx'
import { scopeStop } from './scope-optics.ts'
import { Puzzle } from './puzzles.tsx'
import { makeRuntime } from './runtime.ts'
import { MobileControls, touchDevice } from './mobile-controls.tsx'
import { Scene } from './scene.tsx'
import { bearing, places, type PlaceId } from './world-data.ts'
import menuIsland from './assets/menu-island.jpg?url&inline'

type Panel='pause'|'map'|'journal'|'inventory'|'settings'|'controls'|'item'|'victory'|'reset'|'npc'|'fieldwork'|null
const initialSave=()=>decodeSave(readStorage(saveKey))
const keys=[['W A S D','Move'],['Mouse','Look'],['Shift','Run'],['Space','Jump'],['E','Interact'],['F','Talk to Inès'],['G','Field observation'],['N','Field notebook'],['M','Field map'],['J','Journal'],['I / Tab','Inventory'],['H','Objective hint'],['V','Switch camera'],['Esc','Pause']]
const itemActions={inspect:'Examine',note:'Read',part:'Collect',relic:'Collect',view:'Mark viewpoint',secret:'Record discovery',puzzle:'Operate',ending:'Read'}
const panelTitles={pause:'Expedition paused',map:'Field map',journal:'Expedition journal',inventory:'Field inventory',settings:'Settings',controls:'Controls',reset:'Start a new expedition?',victory:'The island is back on the chart'}
const conversations={
  beach:{ro:'Eu sunt Inès. Măsor țărmul pentru harta nouă. Barca a fost trasă pe uscat cu mult timp înainte de ultima furtună. Dacă vrei să refaci traseul expediției, uită-te lângă lăzile de lângă ponton.',en:'I’m Inès. I’m surveying the shore for the new chart. The skiff was dragged ashore long before the last storm. If you’re tracing the expedition, look by the crates near the dock.'},
  forest:{ro:'Fanioanele vechi încă se văd unde se despart potecile. Eu iau ramura către tabără. Cea de lângă trunchiul căzut duce într-o poiană ferită de vânt.',en:'You can still see the old flags at the fork. I’m taking the camp branch. The track by the fallen trunk leads to a sheltered hollow.'},
  camp:{ro:'Pânza portocalie o văd și de pe creastă. Am venit să compar amplasarea taberei vechi cu harta mea. Dacă urci pe poteca vestică, vei auzi apa înainte să vezi cascada.',en:'I can see the orange canvas from the ridge. I’m comparing the old camp to my map. On the western trail you’ll hear the water before you see the falls.'},
  coast:{ro:'Privește dunga întunecată de pe stânci. Valurile ajung acolo la maree înaltă. Pentru harta nouă, urmăresc mai ales conturul de la reflux.',en:'See the dark stripe on the rocks? The waves reach it at high tide. I’m mostly interested in tracing the coastline at ebb.'},
  trail:{ro:'Dacă te dezorientezi, revino la potecă și caută reperele de piatră. Eu mă opresc din când în când să notez măsurătorile. Ne mai vedem pe traseu.',en:'If you lose your bearings, get back to the trail and look for the stone markers. I stop to write down my measurements. I’ll see you along the route.'},
}
const journalKinds=['note','inspect','ending']

class SceneBoundary extends Component<{children:ReactNode; onError:()=>void},{failed:boolean}>{
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  componentDidCatch(_error:Error,_info:ErrorInfo){this.props.onError()}
  render(){return this.state.failed?<div className="scene-error"/>:this.props.children}
}

export function App({focusTenerife,onExploreTenerife}:{focusTenerife:boolean;onExploreTenerife:()=>void}){
  const [device]=useState(touchDevice)
  const [progress,setProgress]=useState<Progress>(()=>initialSave()??emptyProgress())
  const p=useRef(progress)
  const runtime=useRef(makeRuntime(progress.pose,progress.elapsed))
  const [settings,setSettings]=useState(readSettings)
  const language=settings.language
  const t=(english:string)=>translate(language,english)
  const [loaded,setLoaded]=useState(false)
  const [failed,setFailed]=useState(false)
  const [saved,setSaved]=useState(()=>Boolean(initialSave()))
  const [started,setStarted]=useState(false)
  const [islandMenu,setIslandMenu]=useState(false)
  const showScene=started||islandMenu
  const [panel,setPanel]=useState<Panel>(null)
  const [item,setItem]=useState<Item|null>(null)
  const [scopeHeading,setScopeHeading]=useState<number>(scopeStop.initial)
  const turnScope=useCallback((value:number)=>setScopeHeading(value),[])
  const [target,setTarget]=useState<Item|null>(null)
  const [fieldTarget,setFieldTarget]=useState<FieldId|null>(null)
  const [fieldActive,setFieldActive]=useState<FieldId|null>(null)
  const [npcNear,setNpcNear]=useState(false)
  const [npcStation,setNpcStation]=useState<keyof typeof conversations>('beach')
  const [selectedNote,setSelectedNote]=useState<string|null>(null)
  const [toast,setToast]=useState<{title:string;detail:string;stamp:number}|null>(null)
  const [hintOverride,setHintOverride]=useState<boolean|null>(null)
  const [capture,setCapture]=useState(false)
  const [storageWarning,setStorageWarning]=useState(false)
  const surface=useRef<HTMLCanvasElement|null>(null)
  const compass=useRef<HTMLDivElement>(null)
  const toastTimer=useRef<number|undefined>(undefined)
  const restoreIslandButton=useRef(false)
  const isLive=started && !panel && !failed
  const live=useRef(isLive)
  live.current=isLive
  const lastPanel=useRef<Panel>(null)
  const resetBack=useRef<Panel>(null)
  const wonNow=useRef(false)
  const actions=useRef<{interact:()=>void;show:(next:Panel)=>void;escape:()=>void;hint:()=>void;camera:()=>void;talk:()=>void;field:()=>void;notebook:()=>void;save:()=>void}>({
    interact:()=>{},show:()=>{},escape:()=>{},hint:()=>{},camera:()=>{},talk:()=>{},field:()=>{},notebook:()=>{},save:()=>{}
  })
  const viewingScope=panel==='item'&&item?.id==='sight'&&!solved(progress,'sight')&&!prerequisites(progress,'sight')
  const goal=nextObjective(progress)
  const cleared=has(progress,'final')
  const completed=doneCount(progress)
  const showHint=hintOverride??goal?.showHintByDefault??false
  const hintText=cleared?'Find the remaining artifacts, viewpoints and concealed locations.':(device?goal?.touchHint:undefined)??goal?.hint??''

  const save=(value=p.current)=>{
    if(writeStorage(saveKey,{...value,pose:{...runtime.current.pose},elapsed:runtime.current.elapsed})){
      setSaved(true);setStorageWarning(false)
    }else setStorageWarning(true)
  }
  const commit=(value:Progress)=>{
    if(value===p.current)return
    p.current=value
    setProgress(value)
    save(value)
  }
  const notify=(title:string,detail:string)=>{
    window.clearTimeout(toastTimer.current)
    setToast({title,detail,stamp:Date.now()})
    toastTimer.current=window.setTimeout(()=>setToast(null),3200)
  }
  const dropCapture=()=>{
    runtime.current.locked=false
    runtime.current.touchMove={x:0,z:0}
    runtime.current.touchJump=false
    if(document.pointerLockElement)document.exitPointerLock?.()
    setCapture(false)
  }
  const lockPointer=()=>{
    if(device||!surface.current?.requestPointerLock||document.pointerLockElement===surface.current)return
    try {
      const result=surface.current.requestPointerLock()
      if(result)void result.catch(()=>setCapture(false))
    } catch { setCapture(false) }
  }
  const open=(next:Panel)=>{
    if(next){
      live.current=false
      dropCapture()
      if(started)save()
    }
    setPanel(next)
    if(next==='journal')setSelectedNote(null)
  }
  const start=(fresh:boolean)=>{
    const value=fresh?emptyProgress():initialSave()??p.current
    runtime.current=makeRuntime(value.pose,value.elapsed)
    p.current=value
    setProgress(value)
    setTarget(null)
    setNpcNear(false)
    setFieldTarget(null)
    setFieldActive(null)
    setSelectedNote(null)
    wonNow.current=false
    lastPanel.current=null
    setHintOverride(null)
    setPanel(null)
    setStarted(true)
    setToast(null)
    save(value)
    void islandAudio.start()
    lockPointer()
  }
  const closeItem=()=>{
    if(wonNow.current){
      wonNow.current=false
      open('victory')
    }else if(lastPanel.current){
      open(lastPanel.current)
      lastPanel.current=null
    }else open(null)
  }
  const enterItem=(value:Item)=>{
    const previous=p.current
    if(!objectAvailable(previous,value))return
    if(value.kind==='puzzle'||value.kind==='ending'&&!has(previous,'final')){
      if(value.id==='sight')setScopeHeading(scopeStop.initial)
      setItem(value);open('item')
      return
    }
    const next=collect(previous,value)
    commit(next)
    if(next!==previous)islandAudio.chime(true)
    if(value.kind==='note'||value.kind==='inspect'||value.kind==='ending'){
      setItem(value);open('item')
    }else{
      notify(localItem(value,language).title,t(value.kind==='part'?'Added to your inventory.':value.kind==='view'?'Viewpoint charted.':value.kind==='secret'?'Hidden location charted.':'Expedition artifact recovered.'))
    }
  }
  const escape=()=>{
    if(panel==='item')closeItem()
    else if(panel==='victory')open(null)
    else if(panel==='reset')open(resetBack.current)
    else if(panel==='settings'||panel==='controls')open(lastPanel.current)
    else if(panel)open(null)
    else if(started)open('pause')
  }
  const show=(next:Panel)=>{
    if(!started||panel==='reset'||panel==='victory')return
    if(wonNow.current){closeItem();return}
    if(panel===next){open(null);return}
    lastPanel.current=null
    open(next)
  }
  actions.current={
    interact:()=>{if(live.current&&runtime.current.target)enterItem(runtime.current.target)},
    show,escape,hint:()=>{if(live.current)setHintOverride(value=>!(value??showHint))},
    field:()=>{
      if(!live.current)return
      const {x,z,yaw}=runtime.current.pose
      const site=nearestFieldwork(x,z,bearing(yaw),p.current.fieldwork??[])
      if(site){setFieldActive(site.id);open('fieldwork')}
    },
    notebook:()=>{if(!started)return;setFieldActive(null);show('fieldwork')},
    talk:()=>{if(live.current&&Math.hypot(runtime.current.pose.x-runtime.current.npc.x,runtime.current.pose.z-runtime.current.npc.z)<7.2){
      setNpcStation(runtime.current.npc.station??'trail');open('npc')
    }},
    camera:()=>{if(live.current)setSettings(value=>({...value,camera:value.camera==='first'?'third':'first'}))},
    save:()=>{if(started)save()}
  }
  useEffect(()=>{
    const keydown=(event:KeyboardEvent)=>{
      if(event.repeat || event.ctrlKey || event.metaKey || event.altKey)return
      const typing=event.target instanceof HTMLElement&&['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)
      if(event.code==='Escape'){event.preventDefault();actions.current.escape();return}
      if(typing)return
      if(event.code==='KeyE')actions.current.interact()
      if(event.code==='KeyM')actions.current.show('map')
      if(event.code==='KeyJ')actions.current.show('journal')
      if(event.code==='KeyI'||(event.code==='Tab'&&live.current)){
        event.preventDefault()
        actions.current.show('inventory')
      }
      if(event.code==='KeyH')actions.current.hint()
      if(event.code==='KeyV')actions.current.camera()
      if(event.code==='KeyF')actions.current.talk()
      if(event.code==='KeyG')actions.current.field()
      if(event.code==='KeyN')actions.current.notebook()
    }
    const pageHide=()=>actions.current.save()
    const visibility=()=>{if(document.visibilityState==='hidden')actions.current.save()}
    const lockChanged=()=>setCapture(document.pointerLockElement===surface.current)
    window.addEventListener('keydown',keydown)
    window.addEventListener('pagehide',pageHide)
    document.addEventListener('visibilitychange',visibility)
    document.addEventListener('pointerlockchange',lockChanged)
    return ()=>{
      clearTimeout(toastTimer.current)
      window.removeEventListener('keydown',keydown)
      window.removeEventListener('pagehide',pageHide)
      document.removeEventListener('visibilitychange',visibility)
      document.removeEventListener('pointerlockchange',lockChanged)
    }
  },[])
  useEffect(()=>{islandAudio.setVolume(settings.volume);writeStorage(settingsKey,settings)},[settings])

  useEffect(()=>{document.documentElement.lang=language;document.title=translate(language,'The Forgotten Island');setToast(null)},[language])

  const configure=(next:'settings'|'controls')=>{lastPanel.current=panel;open(next)}
  const askNew=()=>{if(saved){resetBack.current=panel;open('reset')}else start(true)}
  const toMainMenu=()=>{
    restoreIslandButton.current=true
    surface.current=null
    setLoaded(false)
    setFailed(false)
    setIslandMenu(false)
  }
  const toMenu=()=>{
    save();setStarted(false);dropCapture();setPanel(null);setToast(null);setHintOverride(null)
    toMainMenu()
  }
  const onPlace=(id:PlaceId)=>{
    const next=discover(p.current,id)
    if(next===p.current)return
    commit(next)
    if(id!=='beach')notify(t(places[id].name),t(places[id].caption))
  }
  const notes=items.filter(i=>journalKinds.includes(i.kind)&&has(progress,i.id))
  const note=notes.find(i=>i.id===selectedNote)
  const objects=items.filter(i=>(i.kind==='part'||i.kind==='relic')&&has(progress,i.id))
  const stats={relics:relics.filter(i=>has(progress,i.id)).length,secrets:secrets.filter(i=>has(progress,i.id)).length,views:views.filter(i=>has(progress,i.id)).length}
  const panelTitle=panel==='item'&&item?localItem(item,language).title:panel==='npc'?'Inès Vidal':panel==='fieldwork'?t('Field notebook'):panel&&panel!=='item'?t(panelTitles[panel]):null

  return <main className={'game'+(started?' active-game':' title-game')+(device?' touch-game':'')} data-mode={started?(panel??'play'):'menu'} data-camera={settings.camera}>
    {(!showScene||!loaded)&&<div className="menu-backdrop" aria-hidden="true" style={{backgroundImage:`url("${menuIsland}")`}}/>}
    {showScene&&<SceneBoundary onError={()=>setFailed(true)}><Scene runtime={runtime} progress={progress} settings={settings}
      live={isLive} menu={!started} hud={compass} scopeHeading={viewingScope?scopeHeading:undefined}
      onReady={canvas=>{surface.current=canvas;setLoaded(true)}}
      callbacks={{
        onPlace,onTarget:setTarget,onNpcNear:setNpcNear,onField:setFieldTarget,onHeartbeat:()=>save(),
        onCaptureExit:()=>{if(live.current)open('pause')}
      }}
    /></SceneBoundary>}
    {!started&&<section className="main-menu" aria-label={t(islandMenu?'Hidden Island':'Main menu')}>
      <div className="menu-content">
        <div className="menu-rule" aria-hidden="true"><span>✦</span></div>
        <h1><span>{t('The Forgotten')}</span><strong>{t('Island')}</strong></h1>
        <p className="menu-intro">{t('Follow the clues left by a 1986 expedition and find out why the island disappeared from maps.')}</p>
        <div className="menu-actions">
          {islandMenu?<>
            {saved&&<button key="continue" className="button primary" disabled={!loaded} onClick={()=>start(false)}>{t('Continue')} <span aria-hidden="true">→</span></button>}
            <button key="new" className={'button '+(saved?'secondary':'primary')} disabled={!loaded} onClick={askNew}>{t('New game')} <span aria-hidden="true">→</span></button>
          </>:<>
            <button key="island" className="button primary" autoFocus={restoreIslandButton.current} onClick={()=>setIslandMenu(true)}>{t('Hidden Island')} <span aria-hidden="true">→</span></button>
            <button key="tenerife" className="button secondary" autoFocus={focusTenerife&&!restoreIslandButton.current} onClick={onExploreTenerife}>{t('Explore by car')} <span aria-hidden="true">→</span></button>
          </>}
          <div className="submenu">
            {islandMenu&&<button className="text-button" autoFocus onClick={toMainMenu}>{t('Main menu')}</button>}
            <button className="text-button" onClick={()=>configure('settings')}>{t('Settings')}</button>
            <button className="text-button" onClick={()=>configure('controls')}>{t('Controls')}</button>
          </div>
        </div>
      </div>
      <div className="menu-footer"><span>{t('Single-player exploration')}</span><span>{t(device?'Touch controls':'Keyboard & mouse')}</span></div>
      {showScene&&!loaded&&!failed&&<p className="engine-status" role="status">{t('Preparing the island…')}</p>}
    </section>}
    {failed&&<div className="engine-error" role="alert">{t('The island could not open a 3D scene. Enable hardware acceleration and WebGL 2 in your browser, then reload.')}</div>}
    {isLive&&<div className="hud">
      <aside className="objective" aria-live="polite"><div className="eyebrow">{t(cleared?'EXPEDITION COMPLETE':'NEXT STEP')}<span>{completed}/{objectives.length}</span></div>
        <strong>{t(cleared?'Explore the island':goal?.title??'Explore your surroundings')}</strong>
        <div className="progress-track" aria-hidden="true"><i style={{width:completed/objectives.length*100+'%'}}/></div>
        <p className="hud-hint" hidden={!showHint}>{t(hintText)}</p>
      </aside>
      <div className="compass" ref={compass} data-testid="compass" aria-label={t("Compass heading")}>
        <div className="compass-rule" aria-hidden="true"/><b>N 000°</b>
      </div>
      <div className={'crosshair'+(target?' has-target':'')} aria-hidden="true"/>
      {!device&&!capture&&<button className="mouse-capture" onClick={lockPointer}>{t('Click to capture mouse')}</button>}
      {!device&&target&&<button className="interaction" data-target={target.id} onClick={actions.current.interact}><kbd>E</kbd><span>{t(itemActions[target.kind])} <b>{localItem(target,language).title}</b></span></button>}
      {!device&&npcNear&&<button className={'interaction'+(target?' npc-interaction':'')} onClick={actions.current.talk}><kbd>F</kbd><span>{t('Talk to')} <b>Inès Vidal</b></span></button>}
      {!device&&fieldTarget&&<button className="interaction field-interaction" onClick={actions.current.field}><kbd>G</kbd><span>{t('Field observation')}</span></button>}
      {toast&&<div key={toast.stamp} className="toast" role="status"><span aria-hidden="true">✦</span><div><strong>{toast.title}</strong><small>{toast.detail}</small></div></div>}
      {!device&&<div className="hud-tools">
        <button onClick={()=>show('map')}><kbd>M</kbd> {t('Map')}</button><button onClick={()=>show('journal')}><kbd>J</kbd> {t('Journal')}</button>
        <button onClick={()=>show('inventory')}><kbd>I</kbd> {t('Inventory')}</button><button aria-pressed={showHint} onClick={actions.current.hint}><kbd>H</kbd> {t('Hint')}</button>
        <button onClick={actions.current.notebook}><kbd>N</kbd> {t('Nature')}</button>
        <button onClick={actions.current.camera}><kbd>V</kbd> {t('Camera')}</button>
        <button onClick={()=>open('pause')} className="pause-tool"><kbd>Esc</kbd> {t('Pause')}</button>
      </div>}
      {device&&<>
        <p className="touch-orientation">{t('Turn your phone sideways for a wider view.')}</p>
        <MobileControls runtime={runtime} language={language}
          interact={target?{target:target.id,label:t(target.id==='lockbox'?'Open':itemActions[target.kind])+' · '+localItem(target,language).title,action:actions.current.interact}:undefined}
          talk={npcNear?{label:t('Talk to')+' Inès',action:actions.current.talk}:undefined}
          field={fieldTarget?{label:t('Field observation'),action:actions.current.field}:undefined}
          tools={[
            {label:'Map',action:()=>show('map')},{label:'Journal',action:()=>show('journal')},
            {label:'Inventory',action:()=>show('inventory')},{label:'Hint',glyph:'?',pressed:showHint,action:actions.current.hint},
            {label:'Nature',action:actions.current.notebook},{label:'Camera',glyph:'◉',action:actions.current.camera},
            {label:'Pause',glyph:'❚❚',action:()=>open('pause')},
          ]}/>
      </>}
    </div>}
    {storageWarning&&<div className="storage-warning" role="status">{t('Local saves are unavailable in this browser session.')}</div>}
    {panel&&<div className={'panel-backdrop'+(!started?' over-menu':'')+(viewingScope?' scope-backdrop':'')}>
      <section className={'panel panel-'+panel+(panel==='item'&&item?.kind==='puzzle'?' panel-puzzle':'')} role="dialog" aria-modal="true" aria-label={panelTitle??t('Expedition')}>
        <div className="panel-header">
          <div><div className="eyebrow">{t(panel==='item'?(item?.kind==='puzzle'?'FIELD MECHANISM':places[item?.area??'beach'].name):'The Forgotten Island')}</div><h2>{panelTitle}</h2></div>
          <button className="close-button" aria-label={t("Close panel")} onClick={escape}>×</button>
        </div>
        {panel==='pause'&&<div className="pause-menu">
          <button className="button primary" onClick={()=>{open(null);lockPointer()}}>{t('Resume expedition')} <span>→</span></button>
          <button className="button secondary" onClick={()=>configure('settings')}>{t('Settings')}</button>
          <button className="button secondary" onClick={()=>configure('controls')}>{t('Controls')}</button>
          {cleared&&<button className="button secondary" onClick={()=>open('victory')}>{t('Expedition results')}</button>}
          <button className="text-button" onClick={()=>{runtime.current.recover=true;notify(t('Returned to Arrival Beach'),t('Your expedition records are safe.'));open(null)}}>{t('Return to the beach')}</button>
          <button className="text-button" onClick={toMenu}>{t('Save and return to title')}</button>
        </div>}
        {panel==='controls'&&(device?<p>{t('Hold an arrow to move. Swipe the scene to look around. Use the action button when an object is in reach and + or − to change zoom.')}</p>:<>
          <dl className="control-grid">{keys.map(([key,action])=><div key={key}><dt>{t(action)}</dt><dd><kbd>{t(key)}</kbd></dd></div>)}</dl>
          <p className="subdued">{t('Arrow keys or dragging the view also turn the camera. On touch screens, use the movement pad and drag the view.')}</p>
        </>)}
        {panel==='settings'&&<>
          <label className="setting-row"><span>{t(device?'Look sensitivity':'Mouse sensitivity')}</span><output>{settings.sensitivity.toFixed(2)}×</output><input type="range" min=".25" max="2.5" step=".05" value={settings.sensitivity} onChange={e=>setSettings({...settings,sensitivity:e.target.valueAsNumber})}/></label>
          <label className="setting-row"><span>{t('Master volume')}</span><output>{Math.round(settings.volume*100)}%</output><input type="range" min="0" max="1" step=".01" value={settings.volume} onChange={e=>setSettings({...settings,volume:e.target.valueAsNumber})}/></label>
          <label className="setting-row"><span>{t('Field of view')}</span><output>{settings.fov}°</output><input type="range" min="55" max="93" value={settings.fov} onChange={e=>setSettings({...settings,fov:e.target.valueAsNumber})}/></label>
          <label className="setting-row graphics"><span>{t('Graphics quality')}</span><select value={settings.quality} onChange={e=>setSettings({...settings,quality:e.target.value as Settings['quality']})}>{(device||settings.quality==='mobile')&&<option value="mobile">{t('Mobile')}</option>}<option value="low">{t('Low')}</option><option value="medium">{t('Medium')}</option><option value="high">{t('High')}</option></select></label>
          <label className="setting-row graphics"><span>{t('Language')}</span><select value={language} onChange={e=>setSettings({...settings,language:resolveLanguage(e.target.value)})}><option value="ro">Română</option><option value="en">English</option></select></label>
          <label className="setting-row graphics"><span>{t('Camera')}</span><select value={settings.camera} onChange={e=>setSettings({...settings,camera:e.target.value==='third'?'third':'first'})}><option value="first">{t('First person')}</option><option value="third">{t('Third person')}</option></select></label>
          {saved&&<button className="text-button danger" onClick={askNew}>{t('Reset expedition progress')}</button>}
        </>}
        {panel==='reset'&&<>
          <p className="subdued">{t('Starting again replaces the current expedition save. Your settings are kept.')}</p>
          <div className="panel-actions"><button className="button primary" onClick={()=>start(true)}>{t('Start new game')}</button><button className="text-button" onClick={escape}>{t('Keep current expedition')}</button></div>
        </>}
        {panel==='map'&&<div className="map-layout">
          <IslandMap progress={progress} language={language} pose={{...runtime.current.pose}} npc={runtime.current.npc}/>
          <aside className="map-sidebar"><span className="eyebrow">{t('Surveyed locations')}</span>
            <ul>{progress.discovered.map(id=><li key={id}>{t(places[id].name)}</li>)}</ul>
            <span className="eyebrow">{t('Chart legend')}</span>
            <p>▲ {t('Your position')}<br/>◉ {t('Known location')}<br/>● {t('Charted viewpoint or hidden spot')}<br/>● {t('Surveyor')}<br/>◇ {t('Field observation')}</p><p>{t(device?'Use + or − to zoom. Drag to pan the zoomed map.':'Drag to pan. Scroll to zoom.')}</p>
          </aside>
        </div>}
        {panel==='journal'&&<div className="journal-layout">
          <div className="journal-list"><span className="eyebrow">{t('Recovered records')} · {notes.length}</span>
            {notes.length===0&&<p className="subdued">{t('Recovered notes will appear here.')}</p>}
            {notes.map(n=><button key={n.id} className={'journal-entry'+(selectedNote===n.id?' selected':'')} onClick={()=>setSelectedNote(n.id)}>{localItem(n,language).title}</button>)}
          </div>
          <div className="journal-page">
            {note&&'text' in note?<article className="paper"><span className="eyebrow">{t(places[note.area].name)}</span><h3>{localItem(note,language).title}</h3><p>{localItem(note,language).text}</p>
              {note.id==='roster'&&<ChartExhibit type="survey" language={language}/>}
              {note.id==='tower-log'&&<ChartExhibit type="official" language={language}/>}</article>:
              <><span className="eyebrow">{t('Main objectives')} · {completed}/{objectives.length}</span><ol className="quest-list">{objectives.map(o=><li className={o.done(progress)?'finished':o===goal?'current':''} key={o.title}>{t(o.title)}</li>)}</ol></>}
            <div className="journal-counters"><span>{stats.relics}/{relics.length} {t('artifacts')}</span><span>{stats.views}/{views.length} {t('viewpoints')}</span><span>{stats.secrets}/{secrets.length} {t('hidden spots')}</span></div>
          </div>
        </div>}
        {panel==='inventory'&&<>
          {objects.length===0?<p className="subdued">{t('Your field bag is empty.')}</p>:<div className="inventory-grid">{objects.map(i=><article key={i.id}><span aria-hidden="true">{artifactGlyph(i)}</span><div><h3>{localItem(i,language).title}</h3>{'text'in i&&<p>{localItem(i,language).text}</p>}</div></article>)}</div>}
        </>}
        {panel==='item'&&item&&(item.kind==='puzzle'?
          <Puzzle key={item.id} id={item.puzzle} touch={device} progress={progress} language={language} onClose={closeItem} onJournal={()=>open('journal')} onScope={turnScope} onSubmit={value=>{
            const result=answer(p.current,item.puzzle,value)
            if(result.progress!==p.current){commit(result.progress);islandAudio.chime(true)}
            else if(!result.correct)islandAudio.chime(false)
            return result
          }}/>:item.kind==='ending'&&!cleared?<ArchiveCharts language={language} onAlign={()=>{
            const next=collect(p.current,item)
            if(next===p.current)return
            wonNow.current=true
            commit(next);islandAudio.chime(true)
          }}/>:<article className="paper item-paper"><span className="eyebrow">{t(item.kind==='inspect'?'Field observation':item.kind==='ending'?'Archive · sealed dispatch':'Expedition record')}</span>
          <p>{localItem(item,language).text}</p>
          {item.id==='roster'&&<ChartExhibit type="survey" language={language}/>}
          {item.id==='tower-log'&&<ChartExhibit type="official" language={language}/>}
          <button className="button paper-button" onClick={closeItem}>{t(wonNow.current?'Close expedition log':'Return to the island')}</button>
        </article>)}
        {panel==='fieldwork'&&<FieldPanel key={fieldActive??'guide'} language={language} id={fieldActive} records={progress.fieldwork??[]}
          onComplete={id=>{
            const current=p.current
            if(current.fieldwork?.includes(id))return
            commit({...current,fieldwork:[...(current.fieldwork??[]),id]})
            islandAudio.chime(true)
          }}
          onClose={()=>open(null)}/>}
        {panel==='npc'&&<article className="paper item-paper">
          <span className="eyebrow">{t('Independent surveyor')}</span>
          <p>{conversations[npcStation][language]}</p>
          <button className="button paper-button" onClick={()=>open(null)}>{t('Close conversation')}</button>
        </article>}
        {panel==='victory'&&<>
          <p className="victory-description">{t('The archive preserves nearly a century of coastal observations. With Mara’s dispatch and the original chart, the island can finally be recorded again.')}</p>
          <dl className="victory-stats">
            <div><dt>{t('Completion')}</dt><dd>{completion(progress)}%</dd></div><div><dt>{t('Expedition time')}</dt><dd>{formatTime(runtime.current.elapsed)}</dd></div>
            <div><dt>{t('Puzzles solved')}</dt><dd>{progress.solved.length}/6</dd></div><div><dt>{t('Artifacts recovered')}</dt><dd>{stats.relics}/{relics.length}</dd></div>
            <div><dt>{t('Hidden places')}</dt><dd>{stats.secrets}/{secrets.length}</dd></div><div><dt>{t('Viewpoints')}</dt><dd>{stats.views}/{views.length}</dd></div>
          </dl>
          <div className="panel-actions"><button className="button primary" onClick={()=>open(null)}>{t('Keep exploring')}</button><button className="text-button" onClick={askNew}>{t('New game')}</button></div>
        </>}
      </section>
    </div>}
  </main>
}
