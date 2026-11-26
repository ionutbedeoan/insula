import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, firefox } from 'playwright'
import { itemsById } from '../src/content.ts'
import { firstApproach, stops } from './routes.mjs'

const mobile=Boolean(process.env.ISLAND_TOUCH_TEST)
const fixture=process.env.ISLAND_BROWSER_FIXTURE
const staticBuild=process.env.ISLAND_STATIC_BUILD
const files=fixture??staticBuild
const optionsFile=process.env.ISLAND_BROWSER_OPTIONS
const browserOptions=optionsFile?JSON.parse(await readFile(optionsFile,'utf8')):{}
const url=files?'https://island.test/':process.env.ISLAND_TEST_URL??'http://127.0.0.1:5173/'
const dir=process.env.ISLAND_SCREENSHOTS??'screenshots'
const screen=mobile?{width:844,height:390}:process.env.ISLAND_LOW_TEST?{width:1000,height:680}:{width:1280,height:800}
const rad=Math.PI/180
const [WALK,RUN]=[5.25,9.2]
const browser=await (!mobile&&(fixture||process.env.ISLAND_TEST_BROWSER==='firefox')?firefox:chromium).launch({headless:process.env.ISLAND_HEADED!=='1',
  ...(process.env.ISLAND_CHROMIUM?{executablePath:process.env.ISLAND_CHROMIUM}:{}),...browserOptions})
const page=await browser.newPage({viewport:screen,...(mobile?{isMobile:true,hasTouch:true,deviceScaleFactor:1}:{})})
const touch=mobile?await page.context().newCDPSession(page):null
const sendTouches=(type,touchPoints)=>touch.send('Input.dispatchTouchEvent',{type,touchPoints})
const location=async locator=>{
  await locator.scrollIntoViewIfNeeded()
  const box=await locator.boundingBox()
  assert.ok(box)
  return {x:box.x+box.width/2,y:box.y+box.height/2,id:1}
}
const tap=async locator=>{
  if(!mobile)return locator.click()
  await locator.waitFor()
  await locator.evaluate(node=>{if(node.closest('.panel'))node.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'})})
  const target=await locator.evaluate(node=>{
    const {x,y,width,height}=node.getBoundingClientRect()
    return {x:x+width/2,y:y+height/2,id:1,name:node.getAttribute('aria-label')||node.textContent}
  })
  if(process.env.ISLAND_TOUCH_DEBUG)console.log('tap',target,await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.outerHTML.slice(0,190),target))
  await sendTouches('touchStart',[{x:target.x,y:target.y,id:1}])
  if(fixture)await wait(60)
  await sendTouches('touchEnd',[])
  if(fixture)await wait(80)
  if(process.env.ISLAND_TOUCH_DEBUG)console.log('mode',await page.locator('main').getAttribute('data-mode'))
}
async function slide(from,dx,dy){
  if(!mobile){
    await page.mouse.move(from.x,from.y)
    await page.mouse.down()
    await page.mouse.move(from.x+dx,from.y+dy,{steps:6})
    await page.mouse.up()
    return
  }
  await sendTouches('touchStart',[{...from,id:1}])
  for(let i=1;i<=5;i++)await sendTouches('touchMove',[{x:from.x+dx*i/5,y:from.y+dy*i/5,id:1}])
  await sendTouches('touchEnd',[])
  if(fixture)await wait(240)
}
if(staticBuild&&process.env.ISLAND_LOW_TEST){
  await page.addInitScript(()=>{
    const key='forgotten-island:settings:v1'
    if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({quality:'low'}))
  })
}
if(files){
  await page.route('https://island.test/**',async route=>{
    const parsed=new URL(route.request().url())
    const file=parsed.pathname==='/'?'index.html':parsed.pathname.slice(1)
    try{
      const body=await readFile(resolve(files,file))
      await route.fulfill({body,status:200,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'})
    }catch{await route.fulfill({status:404,body:'Fixture asset not found'})}
  })
  if(fixture)await page.clock.install()
}
const wait=ms=>fixture?page.clock.runFor(ms):page.waitForTimeout(ms)
await mkdir(dir,{recursive:true})
page.setDefaultTimeout(staticBuild?45000:9000)
const errors=[]
page.on('pageerror',error=>errors.push(error.message))
page.on('console',entry=>{if(entry.type()==='error')errors.push(entry.text())})

const button=(name)=>page.getByRole('button',{name,exact:true})
const click=(name)=>tap(button(name))
const dialog=()=>page.getByRole('dialog')
const checkText=async(regex)=>assert.match(await dialog().innerText(),regex)
const picture=(name)=>process.env.ISLAND_SKIP_SHOTS?Promise.resolve():page.screenshot({path:dir+'/'+name+'.png',timeout:staticBuild?35000:10000})
const hudAction=(key,name)=>mobile?click(name):page.keyboard.press(key)
const escape=()=>mobile?click('Close panel'):page.keyboard.press('Escape')
const heading=(dx,dz)=>(Math.atan2(dx,-dz)/rad+360)%360
const gap=(desired,actual)=>((desired-actual+540)%360)-180
async function pose(){
  await ready()
  return page.getByTestId('compass').evaluate(node=>({
    x:Number(node.dataset.x),z:Number(node.dataset.z),b:Number(node.dataset.heading),y:Number(node.dataset.y)
  }))
}
async function ready(){
  if(mobile&&fixture)await wait(125)
  await page.waitForFunction(()=>document.querySelector('.compass')?.hasAttribute('data-x'),{},{polling:40})
}
async function releaseUsingMap(){
  await ready()
  await hudAction('KeyM','Map')
  await dialog().waitFor()
  await checkText(/Field map/)
  await escape()
  await ready()
}
async function drag(dx,dy=0){
  await slide({x:screen.width*.5,y:screen.height*(mobile?.46:.28)},dx,dy)
  await wait(110)
}
async function aim(b){
  for(let i=0;i<7;i++){
    const delta=gap(b,(await pose()).b)
    if(Math.abs(delta)<1.05)return
    const pixels=Math.max(mobile?-380:-415,Math.min(mobile?380:415,delta*rad/.00235))
    await drag(Math.round(pixels))
  }
  assert.ok(Math.abs(gap(b,(await pose()).b))<3,'The camera did not turn to '+b)
}
async function hold(key,milliseconds,run=false){
  if(mobile){
    const labels={KeyW:'Forward',KeyS:'Backward',KeyA:'Left',KeyD:'Right'}
    const center=await location(button(labels[key]))
    await sendTouches('touchStart',[center])
    try{await wait(milliseconds)}
    finally{await sendTouches('touchEnd',[])}
    await wait(110)
    return
  }
  if(run)await page.keyboard.down('Shift')
  await page.keyboard.down(key)
  try{await wait(milliseconds)}
  finally{await page.keyboard.up(key);if(run)await page.keyboard.up('Shift')}
  await wait(110)
}
async function walk(x,z,tolerance=.48){
  let previous=Infinity,stalled=0
  for(let i=0;i<30;i++){
    const p=await pose()
    const dx=x-p.x,dz=z-p.z,dist=Math.hypot(dx,dz)
    if(dist<=tolerance)return
    if(dist>previous-.06)stalled++
    else stalled=0
    if(stalled>5)throw new Error('Walking stalled at '+JSON.stringify(p)+' en route to '+x+','+z)
    previous=dist
    await aim(heading(dx,dz))
    const run=!mobile&&dist>8
    await hold('KeyW',Math.max(45,Math.min(mobile?3800:2700,(dist-.17)/(run?RUN:WALK)*920)),run)
  }
  throw new Error('Could not arrive at '+x+','+z)
}
const traverse=async(points)=>{for(const [x,z] of points)await walk(x,z)}
async function checkSceneryCollision(x,z,startX,clearance,name){
  await walk(startX,z,.23)
  const start=await pose()
  await aim(heading(x-start.x,z-start.z))
  // Attempt to reach a point inside the obstacle. The brief sprint isolates the
  // impact from the intended ability to slide around a convex obstacle.
  const duration=1000*(Math.hypot(start.x-x,start.z-z)-clearance+.36)/RUN
  await hold('KeyW',duration,true)
  const stopped=await pose()
  assert.ok(stopped.x>x+clearance-.09 && stopped.x<startX-1,
    name+' stops the direct sprint before the center: '+JSON.stringify({start,stopped}))
  await hold('KeyW',140,true)
  const resumed=await pose()
  assert.ok(resumed.x>x+clearance-.29 && Math.hypot(resumed.x-stopped.x,resumed.z-stopped.z)<.72,
    name+' blocks continued forward input: '+JSON.stringify({stopped,resumed}))
  await hold('KeyS',420)
  assert.ok((await pose()).x>resumed.x+1,name+' can be backed away from')
}
async function inspect(id){
  const i=itemsById[id],[x,z]=stops[id]
  await walk(x,z,.3)
  const p=await pose()
  await aim(heading(i.x-p.x,i.z-p.z))
  await page.locator('[data-target="'+id+'"]').waitFor({timeout:3500})
  const hasDialog=['puzzle','ending','note','inspect'].includes(i.kind)
  if(mobile){
    const action=page.locator('.touch-use[data-target="'+id+'"]')
    await tap(action)
  }else await page.keyboard.press('KeyE')
  if(hasDialog)await dialog().waitFor()
}
async function fieldStation(x,z,fx,fz){
  await walk(x,z,.36)
  const p=await pose()
  await aim(heading(fx-p.x,fz-p.z))
  await page.getByRole('button',{name:/Field observation/}).waitFor()
  await page.keyboard.press('KeyG')
  await dialog().waitFor()
}
async function photoActivity(){
  await fieldStation(-104,-49,-105,-52)
  await click('Take photograph')
  await checkText(/Try again/)
  const slider=page.getByRole('slider',{name:'Lens direction'})
  await slider.press('Home')
  for(let i=0;i<44;i++)await slider.press('ArrowRight')
  await click('Take photograph')
  await checkText(/Added to your field notebook/)
  await click('Return to the island')
}
async function read(id,clue){
  await inspect(id)
  if(clue)await checkText(clue)
  await click('Return to the island')
}
async function solveLockbox(wrong){
  await inspect('lockbox')
  const code=page.getByRole('textbox',{name:'Three-digit code'})
  if(wrong){
    await code.fill('000')
    await click('Turn latch')
    await checkText(/latch holds/)
  }
  if(mobile){for(const digit of ['4','7','2'])await click(digit)}else await code.fill('472')
  await click('Turn latch')
  await checkText(/Completed/)
  await click('Return to the island')
  if(wrong){
    await inspect('lockbox')
    await checkText(/Completed/)
    await click('Return to the island')
  }
  await inspect('lens')
}
async function solveRelay(wrong){
  await inspect('relay')
  if(wrong){
    for(const label of ['Signal bell','Full sun','Falling tide'])await click(label)
    await click('Engage relay')
    await checkText(/clicks twice/)
  }
  for(const label of ['Rising air','Full sun','Falling tide'])await click(label)
  await click('Engage relay')
  await checkText(/Completed/)
  await click('Return to the island')
}
async function solveScope(wrong){
  await read('tower-log',/amber ranging boards/)
  if(!wrong){
    await hudAction('KeyJ','Journal')
    await dialog().waitFor()
    await tap(page.getByRole('button',{name:/Scope operator’s card/}))
    await checkText(/Navigation chart · 1951 edition/)
    await escape()
  }
  await inspect('repair')
  if(wrong){
    for(const label of ['Indicator lamp','Wide front collar Empty socket','Objective lens','Reticle socket Empty socket'])await click(label)
    await click('Test assembly')
    await checkText(/fittings differ/)
    await click('Remove parts')
  }
  for(const label of ['Objective lens','Wide front collar Empty socket','Indicator lamp','Reticle socket Empty socket'])await click(label)
  await click('Test assembly')
  await checkText(/Completed/)
  await click('Return to the island')
  await walk(...stops.sight,.3)
  const beforeScope=await pose()
  await inspect('sight')
  await page.locator('.scope-window').waitFor()
  if(fixture)await page.locator('canvas[data-scope-fov="12"]').waitFor()
  if(wrong){
    await click('Confirm alignment')
    await checkText(/need to overlap/)
    await click('Close mechanism')
    const restored=await pose()
    assert.ok(Math.hypot(restored.x-beforeScope.x,restored.z-beforeScope.z)<.5)
    if(fixture)await page.locator('canvas[data-scope-fov]').waitFor({state:'detached'})
    await inspect('sight')
    const box=await page.locator('.scope-reticle').boundingBox()
    await page.mouse.move(box.x+box.width*.68,box.y+box.height*.48)
    await page.mouse.down()
    await page.mouse.move(box.x+box.width*.68-104,box.y+box.height*.48,{steps:6})
    await page.mouse.up()
  }
  const slider=page.getByRole('slider',{name:'Scope bearing'})
  if(mobile){
    const box=await page.locator('.scope-reticle').boundingBox()
    await slide({x:box.x+box.width*.68,y:box.y+box.height*.48},-104,0)
  }else if(!wrong){
    await slider.press('Home')
    for(let i=0;i<41;i++)await slider.press('ArrowRight')
  }
  assert.equal(await slider.inputValue(),'151')
  if(fixture){
    await wait(250)
    const centers=(await page.locator('canvas[data-scope-fov="12"]').getAttribute('data-scope-centers')).split(',').map(Number)
    assert.ok(centers.every(value=>Math.abs(value)<.04),'The world-space boards meet in the reticle')
  }
  if(!wrong)await picture('07b-luneta')
  await click('Confirm alignment')
  await checkText(/Completed/)
  await click('Return to the island')
}
async function solveCoast(wrong){
  await inspect('bearing')
  if(wrong){
    await click('E')
    await click('Record bearing')
    await checkText(/misses the split rock/)
  }
  await click('ESE')
  await click('Record bearing')
  await checkText(/Completed/)
  await click('Return to the island')
  await traverse(firstApproach.archive)
  await read('coast-note',/water running out/)
  await inspect('tide')
  if(wrong){
    await page.getByRole('button',{name:/High/}).click()
    await click('Set tide wheel')
    await checkText(/springs back/)
  }
  await tap(page.getByRole('button',{name:/Ebb/}))
  await click('Set tide wheel')
  await checkText(/door is open/)
  await click('Return to the island')
}
async function finish(withPictures){
  await traverse([[156,38],[159.65,38],[164,38],[169,38],[171.5,39.45]])
  if(withPictures){
    await aim(94)
    await picture('08-research-chamber')
  }
  await inspect('final')
  await checkText(/Match both registration crosses/)
  if(!withPictures){
    await click('Compare the charts')
    await checkText(/Put both blue crosses/)
    await escape()
    await ready()
    await page.reload()
    await click('Hidden Island')
    await click('Continue')
    await releaseUsingMap()
    await inspect('final')
  }
  const chart=page.locator('.chart-table')
  await chart.scrollIntoViewIfNeeded()
  const table=await chart.boundingBox()
  const scale=await chart.evaluate(svg=>svg.getScreenCTM().a)
  await slide({x:table.x+table.width*.58,y:table.y+table.height*.45},-39*scale,28*scale)
  if(withPictures)await picture('08b-harti')
  await click('Compare the charts')
  await checkText(/The island did not vanish/)
  await click('Close expedition log')
  await checkText(/The island is back on the chart/)
  await checkText(/6\/6/)
  if(withPictures)await picture('09-ending')
}
async function metrics(){
  if(fixture)return 'Diagnostic 2D integration fixture; no WebGL FPS measured.'
  return page.evaluate(async()=>{
    const intervals=[]
    let previous=await new Promise(resolve=>requestAnimationFrame(resolve))
    const count=60, deadline=performance.now()+12000
    for(let i=0;i<count&&performance.now()<deadline;i++){
      const frame=await new Promise(resolve=>requestAnimationFrame(resolve))
      intervals.push(frame-previous);previous=frame
    }
    intervals.sort((a,b)=>a-b)
    return {samples:intervals.length,medianFps:Number((1000/intervals[Math.floor(intervals.length*.5)]).toFixed(1)),p95FrameMs:Math.round(intervals[Math.floor(intervals.length*.95)])}
  })
}

async function play(){
  await page.goto(url)
  await button('Insula ascunsă').waitFor()
  await button('Explorează cu mașina').waitFor()
  assert.equal(await page.locator('canvas').count(),0)
  await click('Insula ascunsă')
  assert.equal(await page.locator('html').getAttribute('lang'),'ro')
  if(staticBuild){
    await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Joc nou')&&!b.disabled))
    console.log('WebGL production scene ready.')
  }
  await click('Setări')
  const language=page.getByRole('combobox',{name:'Limbă'})
  assert.equal(await language.inputValue(),'ro')
  const graphics=page.getByRole('combobox',{name:'Calitate grafică'})
  assert.equal(await graphics.inputValue(),staticBuild&&process.env.ISLAND_LOW_TEST?'low':'high')
  if(process.env.ISLAND_LOW_TEST)await graphics.selectOption('low')
  await language.selectOption('en')
  assert.equal(await page.locator('html').getAttribute('lang'),'en')
  await click('Close panel')
  await button('New game').waitFor()
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.includes('New game')&&!b.disabled))
  await picture('01-menu')
  await click('New game')
  await ready()
  const firstHint=page.locator('.hud-hint')
  assert.equal(await firstHint.isVisible(),true)
  assert.match(await firstHint.innerText(),mobile?/gold button/:/WASD/)
  await hudAction('h','Hint')
  assert.equal(await firstHint.isVisible(),false)
  await hudAction('h','Hint')
  assert.equal(await firstHint.isVisible(),true)
  console.log('Pointer lock after starting:',await page.evaluate(()=>Boolean(document.pointerLockElement)))
  await releaseUsingMap()
  await picture('02-beach')
  console.log('Beach frame timing',await metrics())
  if(mobile){
    assert.equal(await page.locator('.touch-pad button').count(),4)
    assert.equal(await page.locator('.hud-tools').count(),0)
    assert.equal(await page.evaluate(()=>Boolean(document.pointerLockElement)),false)
    for(const key of ['KeyW','KeyS','KeyA','KeyD']){
      const before=await pose()
      await hold(key,350)
      const after=await pose()
      const bearing=before.b*rad
      const forward=(after.x-before.x)*Math.sin(bearing)-(after.z-before.z)*Math.cos(bearing)
      const right=(after.x-before.x)*Math.cos(bearing)+(after.z-before.z)*Math.sin(bearing)
      assert.ok(({KeyW:forward,KeyS:-forward,KeyA:-right,KeyD:right})[key]>1,'touch move '+key)
    }
    const forward=await location(button('Forward'))
    const initial=await pose()
    await sendTouches('touchStart',[forward,{x:450,y:168,id:2}])
    await sendTouches('touchMove',[forward,{x:514,y:168,id:2}])
    await wait(230)
    const turning=await pose()
    assert.ok(Math.hypot(turning.x-initial.x,turning.z-initial.z)>.6,'Movement stays active while looking')
    assert.ok(Math.abs(gap(turning.b,initial.b))>6,'The second touch turns the view')
    await sendTouches('touchEnd',[])
    await wait(340)
    const resting=await pose()
    await wait(250)
    const stopped=await pose()
    assert.ok(Math.hypot(resting.x-stopped.x,resting.z-stopped.z)<.35)
    await click('Zoom view in')
    await wait(240)
    if(fixture)assert.equal(await page.locator('canvas').getAttribute('data-view-fov'),'63')
    await click('Zoom view out')
    await wait(240)
    if(fixture)assert.equal(await page.locator('canvas').getAttribute('data-view-fov'),'71')
    await click('Pause')
    await checkText(/Expedition paused/)
    await click('Close panel')
    await page.setViewportSize({width:390,height:844})
    await page.locator('.touch-orientation').waitFor()
    const portrait=await location(button('Forward'))
    assert.ok(portrait.x<180 && portrait.y<844)
    await picture('mobile-portrait')
    await page.setViewportSize(screen)
    await page.locator('.touch-orientation').waitFor({state:'hidden'})
    console.log('All directions, simultaneous movement/look, release, zoom and orientation passed.')
    if(process.env.ISLAND_TOUCH_SMOKE)return
  }
  const surveyor=page.getByRole('button',{name:mobile?'Talk to Inès':/Talk to Inès Vidal/})
  if(mobile){
    await click('Pause')
    await click('Save and return to title')
    await click('Hidden Island')
    await click('New game')
    await click('Start new game')
    await ready()
    await tap(surveyor)
    await checkText(/Inès Vidal/)
    await click('Close conversation')
    await read('wreck',/ALBA III/)
  }else{
    await read('wreck',/ALBA III/)
    await traverse([[22,193]])
    await surveyor.waitFor()
    await page.keyboard.press('KeyF')
    await checkText(/Inès Vidal/)
    await click('Close conversation')
  }
  await hudAction('KeyV','Camera')
  await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('data-camera')==='third')
  await picture('02b-avatar')
  await hudAction('KeyV','Camera')
  await hudAction('KeyM','Map')
  await tap(page.getByRole('button',{name:'Zoom in'}))
  assert.equal(await page.locator('.map-chart').getAttribute('data-zoom'),'1.30')
  await click('Center map')
  assert.equal(await page.locator('.map-chart').getAttribute('data-zoom'),'1.00')
  await escape()
  await read('landing',/orange survey shelter/)
  await traverse([...firstApproach.sand,...firstApproach.forest.slice(0,2)])
  await picture('03-palm-forest')
  await traverse(firstApproach.forest.slice(2))
  await aim(310)
  await picture('04-expedition-camp')
  await read('dispatch',/WIND.+BELL.+SUN/)
  await read('roster',/No\. 4/)
  await solveLockbox(false)
  await traverse(firstApproach.falls)
  await aim(1)
  await picture('05-waterfall')
  await read('keeper',/east-southeast/)
  await inspect('lamp')
  await traverse([[-119.5,-54],...firstApproach.ruins])
  await aim(0)
  await picture('06-signal-ruins')
  await read('relief',/Rising air/)
  await solveRelay(false)
  await traverse([[6,-32],...firstApproach.tower])
  await solveScope(false)
  await aim(151)
  await drag(0,77)
  await picture('07-observation-tower')
  await drag(0,-77)
  await traverse(firstApproach.coast)
  await solveCoast(false)
  await finish(true)
  console.log('First playthrough complete',await dialog().innerText())

  if(mobile){
    await click('Keep exploring')
    await click('Journal')
    await checkText(/Landing log/)
    await click('Close panel')
    await click('Pause')
    await click('Save and return to title')
    await page.reload()
    await click('Hidden Island')
    await click('Continue')
    await ready()
    assert.match(await page.locator('.objective').innerText(),/EXPEDITION COMPLETE/)
    console.log('Touch-only expedition finished all six puzzles and resumed its finished save.')
    return
  }

  await click('New game')
  await click('Start new game')
  await releaseUsingMap()
  assert.equal(await page.locator('html').getAttribute('lang'),'en')
  await page.keyboard.press('KeyI')
  await checkText(/bag is empty/)
  await escape()
  await aim(180)
  await hold('KeyW',2200,true)
  const shoreline=await pose()
  await hold('KeyW',650,true)
  assert.ok(Math.abs((await pose()).z-shoreline.z)<.5,'Ocean collision')
  await traverse([[27,201],[22,201]])
  await checkSceneryCollision(4.6,201.6,11,1.65,'Beach boulder')
  await walk(11,191)
  await checkSceneryCollision(5,187,10,.65,'Palm trunk')
  console.log('Solid palm and boulder stopped sprinting and allowed moving away.')
  await walk(27,196)
  await fieldStation(35,194.5,37,197)
  await page.getByRole('button',{name:/Rock crab/}).click()
  await click('Record observation')
  await checkText(/Added to your field notebook/)
  await click('Return to the island')
  await traverse([[31,195],[23,195]])
  await read('wreck',/ALBA III/)
  await traverse([[22,193]])
  await read('landing',/orange survey shelter/)
  await traverse([[29,188],[38,176],[54,152],[79,119],[102,93],[110,64],[124,39],[137,26],...firstApproach.archive.slice(1)])
  await inspect('tide')
  await checkText(/Verify the bearing/)
  await click('Close mechanism')
  await aim(90)
  await hold('KeyW',1400,true)
  assert.ok((await pose()).x<157.1,'The locked physical gate blocks entry')
  const beforeReload=await pose()
  await page.reload()
  await click('Hidden Island')
  await click('Continue')
  await releaseUsingMap()
  const afterReload=await pose()
  assert.ok(Math.hypot(beforeReload.x-afterReload.x,beforeReload.z-afterReload.z)<1.1)
  await page.keyboard.press('KeyJ')
  await checkText(/Landing log/)
  await escape()
  await traverse([[150,38],[145,25],[137,9],[139,-10],[128,-39],[115,-62],[99,-83],[78,-95],[62,-91],[43,-73],[27,-52],[18,-30],[4,-30],...firstApproach.ruins.slice(0,5).reverse(),[-119.5,-54]])
  await inspect('lamp')
  await read('keeper',/falling tide/)
  await photoActivity()
  await traverse([[-112,-53],[-125,-52]])
  await inspect('fall-view')
  await traverse([[-125,-54],[-132,-79],[-126,-92]])
  await inspect('falls-secret')
  await inspect('gauge')
  await traverse([[-126,-88],[-132,-79],[-134,-74],[-134,-65],[-131,-59],[-125,-54],[-114,-54],...firstApproach.falls.slice().reverse(),[-67,67]])
  await read('dispatch',/Dispatch word/)
  await read('roster',/BELL/)
  await solveLockbox(true)
  await traverse([[-67,67],[-51,43],[-28,30],[-10,12],[4,-29],[5,-39]])
  await read('relief',/Full sun/)
  await solveRelay(true)
  await traverse([[6,-32],...firstApproach.tower])
  await solveScope(true)
  await traverse(firstApproach.coast)
  await solveCoast(true)
  await finish(false)
  await click('Keep exploring')
  await ready()
  await page.keyboard.press('KeyN')
  await checkText(/Rock crab/)
  await checkText(/Waterfall photograph/)
  await picture('10-carnet-acces-secundar')
  await escape()
  await ready()
  assert.match(await page.locator('.objective').innerText(),/EXPEDITION COMPLETE/)
  console.log('Species observation and photograph persisted until the end of the second expedition.')
  console.log('Second playthrough complete. Early access, wrong answers, restart, reload, and continued exploration checked.')
}
try{
  await play()
  assert.deepEqual(errors,[],'Unexpected browser errors')
}catch(error){
  await picture('failure').catch(()=>{})
  console.error('Browser errors',errors)
  throw error
}finally{
  await browser.close()
}
