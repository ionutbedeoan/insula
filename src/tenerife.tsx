import { useEffect, useRef, useState } from 'react'
import routeHtml from '../Ruta-del-Viento/dist/The-Forgotten-Island.html?raw'
import { translate } from './i18n.ts'
import { readSettings } from './progress.ts'

const exitMessage='forgotten-island:exit-tenerife'
const standaloneMenu=/return [\w$]+\?([\w$]+)\.jsx\(([\w$]+),\{onExit:[\w$]+\}\):\1\.jsx\([\w$]+,\{onDrive:[\w$]+\}\)(?=\})/

function routeDocument(){
  // The portable build includes its own title menu. Mount only its driving mode in the frame.
  const html=routeHtml.replace(standaloneMenu,(_menu,jsx,drive)=>
    `return ${jsx}.jsx(${drive},{onExit:()=>parent.postMessage(${JSON.stringify(exitMessage)},"*")})`)
  return html===routeHtml?null:html
    .replace('Înapoi la Insula uitată','Înapoi la meniul principal')
    .replace('Meniul Insula uitată','Meniu principal')
}

export function Tenerife({onExit}:{onExit:()=>void}){
  const frame=useRef<HTMLIFrameElement>(null)
  const [html]=useState(routeDocument)
  useEffect(()=>{
    const onMessage=(event:MessageEvent)=>{
      if(event.source===frame.current?.contentWindow&&event.data===exitMessage)onExit()
    }
    window.addEventListener('message',onMessage)
    return ()=>window.removeEventListener('message',onMessage)
  },[onExit])

  if(html)return <iframe ref={frame} className="tenerife-frame" title="Ruta del Viento" srcDoc={html}/>

  const language=readSettings().language
  return <main className="game">
    <section className="main-menu">
      <div className="menu-content">
        <p role="alert">{translate(language,'Ruta del Viento could not be loaded.')}</p>
        <div className="menu-actions"><button className="button primary" onClick={onExit}>{translate(language,'Main menu')}</button></div>
      </div>
    </section>
  </main>
}
