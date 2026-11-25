import { useEffect, useRef, useState } from 'react'
import routeHtml from '../Ruta-del-Viento/dist/The-Forgotten-Island.html?raw'
import physics from './tenerife/physics.js?raw'
import world from './tenerife/world.js?raw'
import scene from './tenerife/scene.js?raw'
import controls from './tenerife/controls.js?raw'
import upgradeCss from './tenerife/upgrade.css?raw'
import radioSource from './tenerife/bossabossa.mp3?url&inline'
import { translate } from './i18n.ts'
import { readSettings } from './progress.ts'

const exitMessage='forgotten-island:exit-tenerife'
const standaloneMenu=/return [\w$]+\?([\w$]+)\.jsx\(([\w$]+),\{onExit:[\w$]+\}\):\1\.jsx\([\w$]+,\{onDrive:[\w$]+\}\)(?=\})/

// The original delivery has no source map. Keep the original HTML as the base and
// anchor the editable gameplay additions to this version of its standalone script.
function upgradeRoute(html:string){
  const edits: [string|RegExp,string][]=[
    ['class pF{',`const tenerifeRadioSource=${JSON.stringify(radioSource)};\n${physics}\n${world}\n${controls}\nclass pF{
      ambience; ambienceFilter;
      environment(z,speed,live){
        if(!this.context||!this.ambience)return;
        const now=this.context.currentTime;
        const coast=Math.max(0,Math.min(1,(z-990)/470));
        this.ambience.gain.setTargetAtTime(live?(0.018+.036*coast+Math.min(speed/150,.12)):0,now,.21);
        this.ambienceFilter.frequency.setTargetAtTime(310+speed*14+coast*110,now,.22);
      }`],
    ['f.start()}catch{return}this.context.resume()',`f.start();
      const wind=e.createBufferSource(), gain=e.createGain(), filter=e.createBiquadFilter();
      this.ambience=gain;this.ambienceFilter=filter;
      wind.buffer=o;wind.loop=true;filter.type="lowpass";gain.gain.value=0;
      wind.connect(filter).connect(gain).connect(e.destination);wind.start()
    }catch{return}this.context.resume()`],
    ['DA=[xi,mF,DF,wF,CF]', 'DA=[xi,mF,DF,wF,CF,...tenerifeRoads(Fg,X0)]'],
    ['const xT=new Map', 'tenerifeSettlements(KF,(x,z)=>Oa.some(o=>Math.hypot(x-o.x,z-o.z)<12)?null:Ws(x,z));tenerifePlantRoads(DA.slice(5),Ts,Ws,ii,Oa);const xT=new Map'],
    [/function xx\(s,e,t\)\{.*?(?=function DO\()/s,`function xx(x,z,heading){
      const road=Ws(x,z);
      const obstacles=VF(x,z);
      if(!road||road.distance>road.road.half+.4)obstacles.push(...JF(x,z));
      for(const rock of vO)if(Math.abs(rock.x-x)<34&&Math.abs(rock.z-z)<34)
        obstacles.push({x:rock.x,z:rock.z,radius:Math.max(rock.w,rock.d)*.55,halfX:rock.w*.47,halfZ:rock.d*.47,angle:rock.angle});
      obstacles.push({x:-78.1,z:-680,radius:6,halfX:2.5,halfZ:5});
      return tenerifeVehicleHits(x,z,heading,obstacles);
    }`],
    ['s.y=Vd(s.y,_P(s.x,s.z),14,t)', 'tenerifeGroundCar(s,t,_P)'],
    ['8.6*(1-.76*ar(13,55,d))', '8.6*(C?.58:w?1:.78)*(1-.76*ar(13,55,d))'],
    ['C?.75:w?0:.38','C?1.28:w?0:.58'],
    ['Math.min(25,Math.max(15,d-t*8))','Math.max(17,d-t*9)'],
    ['s.roll=0,s.pitch=Math.atan2(n.y-t.y,2)', 's.roll=0,s.pitch=Math.atan2(n.y-t.y,2),delete s.groundY,delete s.groundPitch,delete s.groundRoll,tenerifeGroundCar(s,1,_P)'],
    [/function wO\(\{runtime:.*?(?=function CO\()/s,scene+'\n'],
    ['e.current&&(e.current.rotation.y=-P.heading)','e.current&&(e.current.visible=!s.current.active||s.current.camera!==1||!!s.current.walker,e.current.rotation.y=-P.heading)'],
    ['E.jsx(RF,{runtime:s.runtime})','E.jsx(RF,{runtime:s.runtime}),E.jsx(TenerifeCockpit,{runtime:s.runtime}),E.jsx(TenerifeWorldDetails,{}),E.jsx(TenerifeFinds,{runtime:s.runtime})'],
    ['"data-drive-ready":r','"data-exploration":S.current.walker?"walking":"driving","data-walker-x":S.current.walker?.x,"data-walker-z":S.current.walker?.z,"data-walker-heading":S.current.walker?.heading,"data-drive-camera":S.current.camera,"data-camera-orbit":S.current.orbit??0,"data-car-y":w.y,"data-drive-ready":r'],
    ['className:"drive-tools",children:[','className:"drive-tools",children:[E.jsx(TenerifeControls,{runtime:S,dialog:d,notify:ce}),'],
    ['$.camera=($.camera+1)%3,$.resetCamera=!0','$.camera=($.camera+1)%3,$.orbit=0,$.tilt=0,$.resetCamera=!0'],
    ['"Capotă"','"Habitaclu"'],
    ['S.current.car=ET(),C({...S.current.car})','S.current.car=ET(),S.current.walker=null,S.current.orbit=0,S.current.tilt=0,C({...S.current.car})'],
    ['function QO(s){WM(s.car)','function QO(s){if(s.walker)return;WM(s.car)'],
    ['" Revenire"]','" Revenire ",E.jsx("kbd",{children:"F"})," Urcă / coboară"]'],
    ['viewBox:"-890 -1750 1450 3460"','viewBox:"-950 -1750 1510 3460"'],
    ['r:"33",fill:"#eed5ad"}),E.jsx("path",{transform:', 'r:"33",fill:"#eed5ad"}),e&&[["San Bruma",-620,343],["Caleta Sur",-480,1262],["Lomo del Pinar",-150,-478],["Cascada del Alisio",-86,-685]].map(([label,x,z])=>E.jsx("text",{x,y:z,fill:"#f2e6cd",stroke:"#203430",strokeWidth:8,paintOrder:"stroke",fontSize:52,children:label},label)),s.walker&&E.jsx("circle",{cx:s.x,cy:s.z,r:26,fill:"#dcaa61"}),E.jsx("path",{transform:'],
    [/"aria-label":\$\.label/g, '"aria-label":S.current.walker?({throttle:"Mergi înainte",reverse:"Mergi înapoi",left:"Mergi la stânga",right:"Mergi la dreapta"})[$.action]:$.label'],
    ['strokeDasharray:n?"14 21":void 0','strokeDasharray:n&&n<5?"14 21":void 0'],
    ['transform:`translate(${s.x} ${s.z}) rotate(${s.heading*180/Math.PI})`','transform:`translate(${s.walker?.x??s.x} ${s.walker?.z??s.z}) rotate(${(s.walker?.heading??s.heading)*180/Math.PI})`'],
    ['n?t?.115:.069:0','n?t?.126:.082:0'],
    ['.035+Math.min(1,u/160)*(e.surface==="asphalt"?.16:.38)','.026+Math.min(1,u/106)*(e.surface==="asphalt"?.18:e.surface==="gravel"?.43:.31)'],
    ['envMapIntensity:1.3,side:qn','envMapIntensity:1.52,side:qn'],
    ['clearcoatRoughness:.17','clearcoatRoughness:.105'],
    ['detail:f<=1?40:f<=3?20','detail:f<=1?64:f<=3?20'],
    ['float fac=.63+.46*detail+.16*grit;', 'float fac=.62+.47*detail+.15*grit;'],
    ['</head>','<style>'+upgradeCss+'</style></head>'],
  ]
  for(const [original,replacement] of edits){
    const next=html.replace(original,()=>replacement)
    if(next===html)throw new Error('Ruta del Viento source anchor not found: '+original.toString())
    html=next
  }
  return html
}

function routeDocument(){
  // The portable build includes its own title menu. Mount only its driving mode in the frame.
  const html=routeHtml.replace(standaloneMenu,(_menu,jsx,drive)=>
    `return ${jsx}.jsx(${drive},{onExit:()=>parent.postMessage(${JSON.stringify(exitMessage)},"*")})`)
  if(html===routeHtml)return null
  try {
    return upgradeRoute(html)
      .replace('Înapoi la Insula uitată','Înapoi la meniul principal')
      .replace('Meniul Insula uitată','Meniu principal')
  } catch(error){
    console.error(error)
    return null
  }
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
