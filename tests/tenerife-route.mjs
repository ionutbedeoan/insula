import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const url=process.env.TENERIFE_URL??pathToFileURL(resolve('The-Forgotten-Island-Mobile.html')).href
const diagnose=process.env.TENERIFE_DIAGNOSE==='1'
const browser=await chromium.launch({
  channel:process.env.TENERIFE_BROWSER??'msedge',
  args:process.env.TENERIFE_SOFTWARE==='1'?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:[],
})
try {
  const page=await browser.newPage({viewport:{width:960,height:540}})
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  page.on('console',message=>{
    if(message.type()==='error'&&/WebGLProgram|Shader Error|VALIDATE_STATUS/i.test(message.text()))errors.push(message.text())
  })
  await page.addInitScript(()=>{
    if(self!==top)return
    window.menuLongTasks=[]
    if(PerformanceObserver.supportedEntryTypes.includes('longtask'))
      new PerformanceObserver(list=>window.menuLongTasks.push(...list.getEntries().map(task=>Math.round(task.duration))))
        .observe({type:'longtask',buffered:true})
    const instrument=html=>{
      const tail='t3.createRoot(document.getElementById("root"))'
      return html.replace(tail,`window.tenerifeVerification={roads:DA,spawn:ET,place:qM,step:DO,
        ground:tenerifeGroundCar,roadAt:pl,originalHeight:_P,land:Ts,ribbon:vg,
        gridHeight:typeof tenerifeTerrainHeight==='function'?tenerifeTerrainHeight:null,
        ribbons:tenerifeRoadRibbons};
        ${tail}`)
        .replace('rs(({ camera }, delta) => {', 'rs(({ camera, gl }, delta) => { window.tenerifeVerification.renderer=gl;')
        .replace('const rt = runtime.current;', 'const rt = runtime.current; window.tenerifeVerification.runtime=rt;')
    }
    const doc=Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype,'srcdoc')
    Object.defineProperty(HTMLIFrameElement.prototype,'srcdoc',{
      ...doc,
      set(html){doc.set.call(this,instrument(html))},
    })
    const attribute=Element.prototype.setAttribute
    Element.prototype.setAttribute=function(name,value){
      return attribute.call(this,name,name.toLowerCase()==='srcdoc'&&this instanceof HTMLIFrameElement?instrument(value):value)
    }
  })
  await page.goto(url)
  const entry=page.getByRole('button',{name:diagnose?/^Explorează (Tenerife|cu mașina)$/: 'Explorează cu mașina',exact:true})
  await entry.waitFor()
  if(!diagnose){
    await page.locator('.menu-backdrop').waitFor()
    assert.equal(await page.locator('canvas').count(),0,'The main menu starts without WebGL')
    console.log('Main menu long tasks before selecting a game (ms)',await page.evaluate(()=>window.menuLongTasks))
  }
  await entry.click()
  const frame=page.frames().find(child=>child.url()==='about:srcdoc')??await page.waitForEvent('framenavigated',{predicate:child=>child.url()==='about:srcdoc'})
  await frame.getByRole('button',{name:'Pornește la drum'}).click({timeout:90000})
  const result=await frame.evaluate(()=>{
    const test=window.tenerifeVerification
    const primary=new Map(),secondary=new Map()
    for(const kind of ['shoulder','asphalt','gravel']){
      for(const [selection,bins] of [['main',primary],['other',secondary]]){
        const geometry=test.ribbon(draw=>test.ribbons((points,left,right,lift,uv,fit)=>{
          const main=points===test.roads[0].points
          if(main&&kind==='shoulder')return
          if(main===(selection==='main'))draw(points,left,right,lift,uv,fit)
        },kind))
        const points=geometry.attributes.position.array
        const indices=geometry.index.array
        for(let i=0;i<indices.length;i+=3){
          const corners=[indices[i],indices[i+1],indices[i+2]].map(index=>points.slice(index*3,index*3+3))
          const [a,b,c]=corners
          const span=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2])
          if(Math.abs(span)<.001)continue
          for(let z=Math.floor(Math.min(...corners.map(p=>p[2]))/8);z<=Math.floor(Math.max(...corners.map(p=>p[2]))/8);z++){
            for(let x=Math.floor(Math.min(...corners.map(p=>p[0]))/8);x<=Math.floor(Math.max(...corners.map(p=>p[0]))/8);x++){
              const key=x+','+z
              if(!bins.has(key))bins.set(key,[])
              bins.get(key).push({a,b,c,span})
            }
          }
        }
        geometry.dispose()
      }
    }
    const ribbonHeight=(bins,x,z)=>{
      let y=-Infinity
      for(const {a,b,c,span} of bins.get(Math.floor(x/8)+','+Math.floor(z/8))??[]){
        const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/span
        const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/span
        if(u>=-.0001&&v>=-.0001&&u+v<=1.0001)y=Math.max(y,u*a[1]+v*b[1]+(1-u-v)*c[1])
      }
      return y
    }
    const groundHeight=(x,z)=>{
      const ix=Math.floor(x/4)*4,iz=Math.floor(z/4)*4
      const u=(x-ix)/4,v=(z-iz)/4
      const b=test.land(ix+4,iz),c=test.land(ix,iz+4)
      return u+v<=1
        ?test.land(ix,iz)*(1-u-v)+b*u+c*v
        :test.land(ix+4,iz+4)*(u+v-1)+b*(1-v)+c*(1-u)
    }
    const surface=(x,z)=>Math.max(groundHeight(x,z),ribbonHeight(primary,x,z),ribbonHeight(secondary,x,z))
    let worst={depth:0},contacts=0
    for(const [index,road] of test.roads.entries()){
      for(const lane of [-road.half+.3,0,road.half-.3]){
        let car=test.spawn()
        delete car.groundPitch
        delete car.groundRoll
        delete car.groundY
        for(let distance=2;distance<road.length-1;distance+=2){
          const pose=test.roadAt(road,distance)
          car.x=pose.x-pose.dz*lane
          car.z=pose.z+pose.dx*lane
          car.heading=Math.atan2(pose.dx,-pose.dz)
          test.ground(car,2/24,test.gridHeight??test.originalHeight)
          for(const side of [-.91,.91]){
            for(const along of [-1.36,1.36]){
              const x=car.x+side*Math.cos(car.heading)+along*Math.sin(car.heading)
              const z=car.z+side*Math.sin(car.heading)-along*Math.cos(car.heading)
              const y=car.y-side*Math.sin(car.roll)+along*Math.sin(car.pitch)*Math.cos(car.roll)
              const depth=surface(x,z)-y
              if(depth>.06)contacts++
              if(depth>worst.depth)worst={depth,index,distance,lane,x,z}
            }
          }
        }
      }
    }
    let highest={rise:0},overlaps=0
    const main=test.roads[0]
    for(let distance=6;distance<main.length-6;distance+=.5){
      const point=test.roadAt(main,distance)
      for(let lane=-4;lane<=4;lane++){
        const x=point.x-point.dz*lane,z=point.z+point.dx*lane
        const deck=ribbonHeight(primary,x,z)
        if(!Number.isFinite(deck))continue
        const side=ribbonHeight(secondary,x,z)
        if(Number.isFinite(side))overlaps++
        const drive=test.gridHeight(x,z)
        const rise=Math.max(side-deck,groundHeight(x,z)-deck,Math.abs(drive-deck))
        if(rise>highest.rise)highest={rise,distance,lane,side,deck,drive}
      }
    }
    return {contacts,worst,overlaps,highest}
  })
  console.log('Visible road and terrain clearance',result)
  if(!diagnose){
    assert.ok(result.worst.depth<=.065,JSON.stringify(result.worst))
    assert.ok(result.overlaps>0&&result.highest.rise<=.035,JSON.stringify(result.highest))
  }
  if(!diagnose){
    const lap=await frame.evaluate(()=>{
      const test=window.tenerifeVerification
      const route=test.roads[0]
      const car=test.spawn()
      for(let tick=0;tick<46000&&!car.finished;tick++){
        const target=test.roadAt(route,car.s+5+Math.abs(car.speed)*.42)
        const angle=Math.atan2(target.x-car.x,car.z-target.z)-car.heading
        const turn=Math.atan2(Math.sin(angle),Math.cos(angle))
        test.step(car,{throttle:car.speed<18,reverse:false,left:turn<-.025,right:turn>.025,brake:car.speed>20},1/80)
      }
      return {finished:car.finished,meters:car.s,impacts:car.impacts,recoveries:car.recoveries,speed:car.speed,x:car.x,z:car.z}
    })
    console.log('Full main route using the driving simulation',lap)
    assert.ok(lap.finished,JSON.stringify(lap))
  }
  const samples=await frame.evaluate(async()=>{
    const test=window.tenerifeVerification
    const route=test.roads[0]
    const rt=test.runtime
    const pedal={throttle:true,reverse:false,left:false,right:false,brake:false}
    const frames=[]
    const segments=[]
    // Cross the coastal, town and forest tile boundaries at the same speed in each run.
    for(const start of [36,1240,3210,4310]){
      test.place(rt.car,start)
      rt.resetCamera=true
      await new Promise(resolve=>setTimeout(resolve,500))
      let last
      const intervals=[]
      const segment=performance.now()
      while(performance.now()-segment<1700){
        const now=await new Promise(resolve=>requestAnimationFrame(resolve))
        if(last!==undefined){
          frames.push(now-last)
          intervals.push(now-last)
        }
        last=now
        const road=test.roadAt(route,Math.min(route.length-20,start+(now-segment)*.05))
        rt.car.x=road.x
        rt.car.z=road.z
        rt.car.heading=Math.atan2(road.dx,-road.dz)
        test.ground(rt.car,1/30,test.gridHeight??test.originalHeight)
        test.step(rt.car,pedal,1/80)
      }
      segments.push({start,frames:intervals.length,max:Math.max(...intervals),
        calls:test.renderer.info.render.calls,triangles:test.renderer.info.render.triangles,
        dpr:test.renderer.getPixelRatio()})
    }
    frames.sort((a,b)=>a-b)
    return {frames:frames.length,median:frames[Math.floor((frames.length-1)*.5)],p95:frames[Math.floor((frames.length-1)*.95)],over50:frames.filter(ms=>ms>50).length,max:frames.at(-1),segments}
  })
  console.log('Rendered frame intervals (ms)',samples)
  assert.ok(samples.frames>=10)
  assert.deepEqual(errors,[])
}finally{await browser.close()}
