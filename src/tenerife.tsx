import { useEffect, useRef, useState } from 'react'
import routeHtml from '../Ruta-del-Viento/dist/The-Forgotten-Island.html?raw'
import physics from './tenerife/physics.js?raw'
import world from './tenerife/world.js?raw'
import scene from './tenerife/scene.js?raw'
import controls from './tenerife/controls.js?raw'
import relief from './tenerife/relief.js?raw'
import terrain from './tenerife/terrain.js?raw'
import visuals from './tenerife/visuals.js?raw'
import forest from './tenerife/forest.js?raw'
import waterways from './tenerife/waterways.js?raw'
import terrainColor from './tenerife/assets/terrain-color.webp?url&inline'
import terrainNormal from './tenerife/assets/terrain-normal.webp?url&inline'
import terrainMaterial from './tenerife/assets/terrain-material.webp?url&inline'
import sky from './tenerife/assets/atlantic.hdr?url&inline'
import barkColor from './tenerife/assets/bark-color.webp?url&inline'
import barkNormal from './tenerife/assets/bark-normal.webp?url&inline'
import basalt from './tenerife/assets/basalt.json'
import lava from './tenerife/assets/lava.json'
import trunk from './tenerife/assets/trunk.json'
import upgradeCss from './tenerife/upgrade.css?raw'
import radioSource from './tenerife/bossabossa.mp3?url&inline'
import { translate } from './i18n.ts'
import { readSettings } from './progress.ts'

const exitMessage='forgotten-island:exit-tenerife'
const standaloneMenu=/return [\w$]+\?([\w$]+)\.jsx\(([\w$]+),\{onExit:[\w$]+\}\):\1\.jsx\([\w$]+,\{onDrive:[\w$]+\}\)(?=\})/

// The original delivery has no source map. Keep the original HTML as the base and
// anchor the editable gameplay additions to this version of its standalone script.
function upgradeRoute(html:string){
  const assets=JSON.stringify({
    color:terrainColor,normal:terrainNormal,arm:terrainMaterial,sky,barkColor,barkNormal,
    meshes:{basalt,lava,trunk},
  })
  const edits: [string|RegExp,string][]=[
    ["class pF{",`const tenerifeRadioSource=${JSON.stringify(radioSource)};
${physics}
${terrain}
${world}
${controls}
const tenerifeArtAssets=${assets};
${relief}
${visuals}
${forest}
${waterways}
class pF{
      ambience; ambienceFilter;
      environment(z,speed,live){
        if(!this.context||!this.ambience)return;
        const now=this.context.currentTime;
        const coast=Math.max(0,Math.min(1,(z-990)/470));
        this.ambience.gain.setTargetAtTime(live?(0.018+.036*coast+Math.min(speed/150,.12)):0,now,.21);
        this.ambienceFilter.frequency.setTargetAtTime(310+speed*14+coast*110,now,.22);
      }`],
    ["f.start()}catch{return}this.context.resume()",`f.start();
      const wind=e.createBufferSource(), gain=e.createGain(), filter=e.createBiquadFilter();
      this.ambience=gain;this.ambienceFilter=filter;
      wind.buffer=o;wind.loop=true;filter.type="lowpass";gain.gain.value=0;
      wind.connect(filter).connect(gain).connect(e.destination);wind.start()
    }catch{return}this.context.resume()`],
    ["DA=[xi,mF,DF,wF,CF]","DA=[xi,mF,DF,wF,CF,...tenerifeRoads(Fg,X0),...tenerifeReliefRoutes(Fg,X0)]"],
    ["function e0(s,e){","function e0(s,e){return tenerifeGeology(tenerifeBaseGeology(s,e),s,e,Vg(e))}function tenerifeBaseGeology(s,e){"],
    ["return t?Ua(t.y-.32,n,ar(t.road.half+4,t.road.half+38,t.distance)):n}function IM","return tenerifeGroundAt(s,e,n,t)}function IM"],
    ["return ar(45,255,s-Vg(e))*ar(200,-380,e)*ar(-1540,-720,e)*(.69+.31*Math.sin(s*.015+e*.006)**2)","return tenerifeForestBiome(ar(45,255,s-Vg(e))*ar(200,-380,e)*ar(-1540,-720,e)*(.69+.31*Math.sin(s*.015+e*.006)**2),s,e,Vg(e))"],
    ["d=Ts(s,e),p=[","d=tenerifeRegisterLot(s,e,t,n,o,Ws(s,e),e0(s,e)),p=["],
    ['b("box",[0,-2.1,0,t,4.38,n,w])',"tenerifeHouseFooting(b,Q,d,t,n,w)"],
    ['b("roof",[0,r-.11,0,t+.66,1.48,n+.66,z])','u>=200?b("houseTrim",[0,r+.34,0,t+.43,.69,n+.43,"#7c7366"]):b("roof",[0,r-.11,0,t+.66,1.48,n+.66,z])'],
    ["Oa.push({x:s,z:e,radius:Math.hypot(t,n)/2","tenerifeHouseDetails(s,e,t,n,r,o,u),Oa.push({x:s,z:e,radius:Math.hypot(t,n)/2"],
    ["const xT=new Map","tenerifeSettlements(KF,(x,z)=>Oa.some(o=>Math.hypot(x-o.x,z-o.z)<12)?null:Ws(x,z));tenerifeDistrict(KF,Ws,Oa);tenerifePlantRoads(DA.slice(5,13),Ts,Ws,ii,Oa);tenerifeRoadsideArt();tenerifeLocalScenery();tenerifeReliefScenery();const xT=new Map"],
    ["function FM(s,e,t){","function FM(s,e,t){return tenerifeForestTile(t,tenerifeBaseTile(s,e,t))}function tenerifeBaseTile(s,e,t){"],
    ["function XF(s,e,t){","function XF(s,e,t){const plot=[];"],
    ["z=Ts(C,B,M),Q=C-Vg(B),b=Math.abs(e0(C+4,B)-e0(C-4,B))+Math.abs(e0(C,B+4)-e0(C,B-4))","z=tenerifeTerrainVertex(C,B,M),Q=C-Vg(B),b=Math.abs(tenerifeTerrainVertex(C+4,B)-tenerifeTerrainVertex(C-4,B))+Math.abs(tenerifeTerrainVertex(C,B+4)-tenerifeTerrainVertex(C,B-4))"],
    ["if(f.copy(Hc.ochre)","if(plot.push(tenerifeLotAt(C,B)?.mix??0),f.copy(Hc.ochre)"],
    ["if(o.push(o[B],o[B+1]-19,o[B+2]),u.push","if(plot.push(plot[B/3]),o.push(o[B],o[B+1]-19,o[B+2]),u.push"],
    ['return d.setAttribute("position",new nt(o,3)),d.setAttribute("color",new nt(u,3)),d.setIndex(P)','return d.setAttribute("position",new nt(o,3)),d.setAttribute("plot",new nt(plot,1)),d.setAttribute("color",new nt(u,3)),d.setIndex(P)'],
    ['.filter(p=>p.kind==="trunk"||p.kind==="rock"&&p.w>2.3).map(p=>({x:p.x,z:p.z,radius:p.kind==="trunk"?p.w*.51:p.w*.39}))','.filter(p=>p.kind==="trunk"||p.kind==="forestBase"||p.kind==="rock"&&p.w>2.3).map(p=>({x:p.x,z:p.z,radius:p.kind==="rock"?p.w*.39:p.w*.51}))'],
    [/function xx\(s,e,t\)\{.*?(?=function DO\()/s,`function xx(x,z,heading){
      const road=Ws(x,z);
      if(tenerifeWetBlocked(x,z,tenerifeTerrainHeight(x,z)))return true;
      const obstacles=VF(x,z);
      if(!road||road.distance>road.road.half+.4)obstacles.push(...JF(x,z));
      for(const rock of vO)if(Math.abs(rock.x-x)<34&&Math.abs(rock.z-z)<34)
        obstacles.push({x:rock.x,z:rock.z,radius:Math.max(rock.w,rock.d)*.55,halfX:rock.w*.47,halfZ:rock.d*.47,angle:rock.angle});
      obstacles.push({x:-78.1,z:-680,radius:6,halfX:2.5,halfZ:5});
      return tenerifeVehicleHits(x,z,heading,obstacles);
    }`],
    ["ge=_P(_,re),ce=_P(s.x,s.z)","ge=tenerifeTerrainHeight(_,re),ce=tenerifeTerrainHeight(s.x,s.z)"],
    [/const ae=_P\(s\.x\+S\*1\.3,.*?s\.y=Vd\(s\.y,_P\(s\.x,s\.z\),14,t\)/s,"tenerifeGroundCar(s,t,tenerifeTerrainHeight)"],
    ["const X4=1/110","const X4=1/80"],
    ["8.6*(1-.76*ar(13,55,d))","8.6*(C?.58:w?1:.78)*(1-.76*ar(13,55,d))"],
    ["C?.75:w?0:.38","C?1.28:w?0:.58"],
    ["Math.min(25,Math.max(15,d-t*8))","Math.max(17,d-t*9)"],
    ["s.roll=0,s.pitch=Math.atan2(n.y-t.y,2)","s.roll=0,s.pitch=Math.atan2(n.y-t.y,2),delete s.groundY,delete s.groundPitch,delete s.groundRoll,tenerifeGroundCar(s,1,tenerifeTerrainHeight)"],
    [/function wO\(\{runtime:.*?(?=function CO\()/s,scene+'\n'],
    ["e.current&&(e.current.rotation.y=-P.heading)","e.current&&(e.current.visible=!s.current.active||s.current.camera!==1||!!s.current.walker,e.current.rotation.y=-P.heading)"],
    ["const P=s.current.car;e.current?.position.set","const P=s.current.visualCar??s.current.car;e.current?.position.set"],
    ["E.jsx(RF,{runtime:s.runtime})","E.jsx(RF,{runtime:s.runtime}),E.jsx(TenerifeCockpit,{runtime:s.runtime}),E.jsx(TenerifeWorldDetails,{}),E.jsx(TenerifeWaterways,{}),E.jsx(TenerifeFinds,{runtime:s.runtime})"],
    ['"data-drive-ready":r','"data-exploration":S.current.walker?"walking":"driving","data-walker-x":S.current.walker?.x,"data-walker-z":S.current.walker?.z,"data-walker-heading":S.current.walker?.heading,"data-drive-camera":S.current.camera,"data-camera-orbit":S.current.orbit??0,"data-car-y":w.y,"data-drive-ready":r'],
    ['className:"drive-tools",children:[','className:"drive-tools",children:[E.jsx(TenerifeControls,{runtime:S,dialog:d,notify:ce}),E.jsx(TenerifeLightButton,{}),'],
    ["$.camera=($.camera+1)%3,$.resetCamera=!0","$.camera=($.camera+1)%3,$.orbit=0,$.tilt=0,$.resetCamera=!0"],
    ['"Capotă"','"Habitaclu"'],
    ["S.current.car=ET(),C({...S.current.car})","S.current.car=ET(),S.current.walker=null,S.current.orbit=0,S.current.tilt=0,C({...S.current.car})"],
    ["function QO(s){WM(s.car)","function QO(s){if(s.walker)return;WM(s.car)"],
    ['" Revenire"]','" Revenire ",E.jsx("kbd",{children:"F"})," Urcă / coboară"]'],
    ['viewBox:"-890 -1750 1450 3460"','viewBox:e?"-1220 -1820 2340 3580":"-950 -1750 1510 3460"'],
    ['d:"M -945 -1750 L -745 -1750 Q -885 -1320 -890 -950 T -890 -150 T -890 695 Q -730 1090 -820 1710 L -945 1710 Z"','d:e?tenerifeMapCoast():"M -945 -1750 L -745 -1750 Q -885 -1320 -890 -950 T -890 -150 T -890 695 Q -730 1090 -820 1710 L -945 1710 Z"'],
    ['r:"33",fill:"#eed5ad"}),E.jsx("path",{transform:','r:"33",fill:"#eed5ad"}),e&&[["San Bruma",-500,246],["Caleta Sur",-470,1276],["Lomo del Pinar",-164,-470]].map(([label,x,z])=>E.jsx("text",{x,y:z,fill:"#f2e6cd",stroke:"#203430",strokeWidth:8,paintOrder:"stroke",fontSize:52,children:label},label)),e&&tenerifeMapLandmarks(),s.walker&&E.jsx("circle",{cx:s.x,cy:s.z,r:26,fill:"#dcaa61"}),E.jsx("path",{transform:'],
    [/"aria-label":\$\.label/g,'"aria-label":S.current.walker?({throttle:"Mergi înainte",reverse:"Mergi înapoi",left:"Mergi la stânga",right:"Mergi la dreapta"})[$.action]:$.label'],
    ['strokeDasharray:n?"14 21":void 0','strokeDasharray:n&&n<5?"14 21":void 0'],
    ["transform:`translate(${s.x} ${s.z}) rotate(${s.heading*180/Math.PI})`","transform:`translate(${s.walker?.x??s.x} ${s.walker?.z??s.z}) rotate(${(s.walker?.heading??s.heading)*180/Math.PI})`"],
    ["n?t?.115:.069:0","n?t?.126:.082:0"],
    ['.035+Math.min(1,u/160)*(e.surface==="asphalt"?.16:.38)','.026+Math.min(1,u/106)*(e.surface==="asphalt"?.18:e.surface==="gravel"?.43:.31)'],
    ["envMapIntensity:1.3,side:qn","envMapIntensity:1.52,side:qn"],
    ["clearcoatRoughness:.17","clearcoatRoughness:.105"],
    ["detail:f<=1?40:f<=3?20:f<=5?10:5","detail:f<=1?40:f<=2?20:f<=4?10:5"],
    ["n.map(o=>E.jsx(ZF,{tx:o.x,tz:o.z,detail:o.detail},o.x+\",\"+o.z))","E.jsx(TenerifeTerrain,{tiles:n,tx:s,tz:e})"],
    [/,r=ee\.useMemo\(\(\)=>\{const o=new Map,u=f=>\{.*?\},\[s,e,t\]\)(?=;return E\.jsxs\(E\.Fragment,\{children:\[E\.jsx\("fogExp2")/s,""],
    ["r.map(([o,u])=>E.jsx(AO,{kind:o,items:u},o))","E.jsx(TenerifeScenery,{tx:s,tz:e,mobile:t})"],
    ["for(const t of DA)e(t.points,-t.half-1.15,t.half+1.15,-.095)","tenerifeRoadRibbons(e,'shoulder')"],
    ['for(const t of DA.filter(n=>n.surface==="asphalt")){const n=t.main?0:.065;e(t.points,-t.half,-2.8,n),e(t.points,-2.8,0,n),e(t.points,0,2.8,n),e(t.points,2.8,t.half,n)}',"tenerifeRoadRibbons(e,'asphalt')"],
    ['for(const t of DA.filter(n=>n.surface==="gravel"))e(t.points,-t.half,t.half,.065,1.6)',"tenerifeRoadRibbons(e,'gravel')"],
    ["E.jsx(BO,{quality:s.quality,mobile:s.mobile})","E.jsx(TenerifeFrameBudget,{quality:s.quality,mobile:s.mobile})"],
    ["material:V4,renderOrder:-1","material:V4,renderOrder:1"],
    ["function AO({kind:","tenerifeInstallArt();tenerifeInstallGrass();tenerifeInstallLocalArt();tenerifeInstallReliefArt();function AO({kind:"],
    ["E.jsx(aO,{})","E.jsx(TenerifeAtmosphere,{quality:!t}),E.jsx(TenerifeShaderWarmup,{})"],
    ["return E.jsxs(fM,{camera:{near:.14","return E.jsxs(fM,{shadows:s.quality&&!s.mobile,camera:{near:.14"],
    ['receiveShadow:s==="box"||s==="roof",renderOrder:','receiveShadow:s==="box"||s==="roof"||s==="rock"||s==="lava"||s==="trunk"||s.startsWith("house")||s.startsWith("forestTrunk"),castShadow:s==="box"||s==="roof"||s==="rock"||s==="lava"||s==="trunk"||s.startsWith("forest")&&!s.endsWith("Far")&&s!=="forestBase",renderOrder:'],
    ['"hemisphereLight",{color:"#c4dbf0"','"hemisphereLight",{name:"Tenerife skylight",color:"#c4dbf0"'],
    ['"directionalLight",{color:"#ffe0b1"','"directionalLight",{name:"Tenerife sunlight",color:"#ffe0b1"'],
    ["</head>","<style>"+upgradeCss+"</style></head>"],
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
