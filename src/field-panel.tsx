import { useState } from 'react'
import { fieldReady, fieldSites, fieldsByKind, tideReading, type FieldId } from './fieldwork.ts'
import type { Language } from './i18n.ts'

const speciesChoices=[
  {id:'shore-crab',glyph:'⌘',ro:'Crab de stâncă',en:'Rock crab'},
  {id:'canopy-butterfly',glyph:'⋈',ro:'Fluture frunză',en:'Leafwing butterfly'},
  {id:'ridge-bird',glyph:'⌁',ro:'Pasăre de pădure',en:'Forest bird'},
] as const

export function FieldPanel({language,id,records,onComplete,onClose}:{language:Language;id:FieldId|null;records:readonly FieldId[];onComplete:(id:FieldId)=>void;onClose:()=>void}){
  const ro=language==='ro'
  const site=fieldSites.find(site=>site.id===id)
  const [choice,setChoice]=useState('')
  const [photo,setPhoto]=useState(-12)
  const [samples,setSamples]=useState(1)
  const [message,setMessage]=useState('')
  if(!site)return <div className="field-guide">
    <p className="subdued">{ro?'Observă fauna, aliniază fotografiile și măsoară mareea. La reperele de teren, apasă G. Locurile apropiate apar pe hartă.':'Observe the wildlife, align your photographs, and measure the tide. Press G at field stations. Nearby stations appear on your map.'}</p>
    {fieldsByKind.map(group=><section key={group.type}><h3>{group.title[language]}</h3><ul>
      {fieldSites.filter(a=>a.type===group.type).map(a=><li key={a.id}><span>{records.includes(a.id)?'✓':'○'}</span>{records.includes(a.id)||a.type!=='species'?a.name[language]:ro?'Specie de identificat':'Species to identify'}</li>)}
    </ul></section>)}
  </div>
  const done=records.includes(site.id)
  function submit(value:string){
    if(site&&fieldReady(site.id,value)){onComplete(site.id);return}
    setMessage(ro?'Încearcă din nou. Compară semnele observate cu opțiunile.':'Try again. Compare the signs you observed with the options.')
  }
  return <div className="field-guide">
    <p className="subdued">{done?site.name[language]:site.note[language]}</p>
    {done?<div className="confirmed" role="status">✓ {ro?'Înregistrat în carnetul de teren.':'Added to your field notebook.'}</div>:
      <>
        {site.type==='species'&&<div className="field-options">{speciesChoices.map(i=><button key={i.id} className={'button secondary'+(choice===i.id?' field-selected':'')} onClick={()=>setChoice(i.id)}><span>{i.glyph}</span> {i[language]}</button>)}</div>}
        {site.type==='photo'&&<>
          <div className={'viewfinder '+(site.id==='photo-falls'?'waterfall-finder':'arch-finder')} aria-hidden="true">
            <div className="finder-reference"/><div className="finder-subject" style={{transform:'translateX('+photo*3.3+'%)'}}/><div className="finder-reticle"/>
          </div>
          <label className="setting-row">{ro?'Direcția obiectivului':'Lens direction'}<span>{photo.toFixed(1)}°</span>
            <input type="range" min="-22" max="22" step=".5" value={photo} onChange={e=>setPhoto(e.target.valueAsNumber)}/>
          </label>
        </>}
        {site.type==='tide'&&<>
          <ol className="tide-samples">{Array.from({length:samples},(_,i)=><li key={i}>{tideReading(i).toLocaleString(language,{minimumFractionDigits:2})} m</li>)}</ol>
          {samples<3?<button className="button secondary" onClick={()=>setSamples(s=>s+1)}>{ro?'Următoarea citire':'Next reading'}</button>:
            <div className="field-options">{[['rising','Flux','Rising'],['ebbing','Reflux','Ebbing'],['stationary','Apa stă','Stationary']].map(([id,roTitle,en])=><button key={id} className={'button secondary'+(choice===id?' field-selected':'')} onClick={()=>setChoice(id)}>{ro?roTitle:en}</button>)}</div>}
        </>}
        {message&&<p className="puzzle-message" role="status">{message}</p>}
      </>}
    <div className="puzzle-commit">
      <button className="text-button" onClick={onClose}>{ro?'Înapoi pe insulă':'Return to the island'}</button>
      {!done&&<button className="button primary" disabled={site.type!=='photo'&&!choice} onClick={()=>submit(site.type==='photo'?String(photo):choice)}>
        {site.type==='photo'?(ro?'Declanșează':'Take photograph'):(ro?'Notează observația':'Record observation')}
      </button>}
    </div>
  </div>
}
