import { useRef, useState } from 'react'
import { chartCoast, chartOffset, chartPins, chartRange, chartsMatch } from './chart-evidence.ts'
import type { Language } from './i18n.ts'

const copy={
  ro:{
    early:'Foaia de teren · 1912',official:'Harta de navigație · ediția 1951',
    earlyNote:'Cercul marchează vechea stație. Linia punctată urmărește bancul de nisip.',
    officialNote:'Între aceleași două repere, insula și bancul de nisip lipsesc din ediția oficială.',
    registered:'Așază foaia de teren peste harta oficială. Potrivește ambele cruci de reper.',
    horiz:'Deplasare orizontală',vert:'Deplasare verticală',action:'Compară hărțile',
    error:'Crucile albastre trebuie să cadă peste cele maronii. Poți trage foaia sau folosi reglajele.',
  },
  en:{
    early:'Field survey · 1912',official:'Navigation chart · 1951 edition',
    earlyNote:'The ring marks the old station. The dotted line follows the shoal.',
    officialNote:'Between the same two reference marks, the island and the shoal are missing from the official edition.',
    registered:'Lay the field survey over the official chart. Match both registration crosses.',
    horiz:'Horizontal position',vert:'Vertical position',action:'Compare the charts',
    error:'Put both blue crosses on the brown ones. Drag the sheet or use the controls.',
  }
}

function ChartInk({survey}:{survey:boolean}){
  return <>
    <path d="M0 59Q68 52 112 50T320 45M0 108Q81 94 159 104T320 95M0 173Q70 157 175 167T320 166M36 0L28 225M134 0L130 225M241 0L248 225M303 0L312 225"
      fill="none" stroke="currentColor" strokeWidth=".7" opacity=".28"/>
    <path d="M26 41V18m-5 8 5-8 5 8M294 181h17m-8-8v16" fill="none" stroke="currentColor" strokeWidth="1.2"/>
    {survey&&<>
      <polygon points={chartCoast} fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeWidth="1.45"/>
      <path d="M113 149c26-14 14-31 33-44s35-17 37-37m-15 42c20-8 26 5 22 18"
        fill="none" stroke="currentColor" opacity=".66"/>
      <path d="M195 142c24-16 50-13 62 3s-3 34-33 26-29-24-29-29Z"
        fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2 4"/>
      <circle cx="184" cy="75" r="6" stroke="currentColor" strokeWidth="1.4" fill="none"/>
    </>}
    {chartPins.map(([x,y])=><path key={x} d={`M${x-8} ${y}h16m-8-8v16`} fill="none" strokeWidth="1.75" stroke="currentColor"/>)}
    <path d="M16 205h52m-52-3v6m26-6v6m26-6v6" fill="none" stroke="currentColor"/>
  </>
}

export function ChartExhibit({type,language}:{type:'survey'|'official';language:Language}){
  const t=copy[language],survey=type==='survey'
  return <figure className="chart-exhibit">
    <figcaption><strong>{survey?t.early:t.official}</strong><span>{survey?t.earlyNote:t.officialNote}</span></figcaption>
    <svg viewBox="0 0 320 224" className={survey?'survey-ink':'official-ink'} aria-hidden="true"><ChartInk survey={survey}/></svg>
  </figure>
}

export function ArchiveCharts({language,onAlign}:{language:Language;onAlign:()=>void}){
  const t=copy[language]
  const [offset,setOffset]=useState(chartOffset)
  const [error,setError]=useState(false)
  const drag=useRef<{id:number;x:number;y:number;start:typeof chartOffset;scale:number}|null>(null)
  const move=(x:number,y:number)=>{
    const clamp=(value:number)=>Math.max(-chartRange,Math.min(chartRange,Math.round(value)))
    setOffset({x:clamp(x),y:clamp(y)});setError(false)
  }
  return <section className="archive-charts">
    <p>{t.registered}</p>
    <div className="chart-legend"><span>{t.official}</span><span>{t.early}</span></div>
    <svg className="chart-table" viewBox="0 0 320 224" aria-hidden="true"
      onPointerDown={e=>{
        if(e.button!==0||drag.current)return
        drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,start:offset,scale:1/(e.currentTarget.getScreenCTM()?.a||e.currentTarget.getBoundingClientRect().width/320)}
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={e=>{
        const from=drag.current
        if(from?.id===e.pointerId)move(from.start.x+(e.clientX-from.x)*from.scale,from.start.y+(e.clientY-from.y)*from.scale)
      }} onLostPointerCapture={event=>{if(drag.current?.id===event.pointerId)drag.current=null}}>
      <g className="official-ink"><ChartInk survey={false}/></g>
      <g className="survey-ink" transform={`translate(${offset.x} ${offset.y})`}>
        <rect x="8" y="8" width="304" height="208" rx="3" fill="#d3e0c0" fillOpacity=".28" stroke="currentColor" strokeOpacity=".44"/>
        <ChartInk survey/>
      </g>
    </svg>
    <div className="chart-adjust">
      <label>{t.horiz}<input type="range" min={-chartRange} max={chartRange} value={offset.x} onChange={e=>move(e.target.valueAsNumber,offset.y)}/></label>
      <label>{t.vert}<input type="range" min={-chartRange} max={chartRange} value={offset.y} onChange={e=>move(offset.x,e.target.valueAsNumber)}/></label>
    </div>
    {error&&<p className="puzzle-message" role="status">{t.error}</p>}
    <button className="button primary" onClick={()=>chartsMatch(offset.x,offset.y)?onAlign():setError(true)}>{t.action}</button>
  </section>
}
