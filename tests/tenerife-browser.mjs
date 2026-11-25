import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'

const url=process.env.TENERIFE_URL??pathToFileURL(resolve('The-Forgotten-Island-Mobile.html')).href
const rounds=Number(process.env.TENERIFE_ROUNDS??2)
const firstRound=Number(process.env.TENERIFE_FIRST_ROUND??1)
const profiles=process.env.TENERIFE_PROFILE?[process.env.TENERIFE_PROFILE]:['desktop','mobile']
const browser=await chromium.launch({
  channel:process.env.TENERIFE_BROWSER??'msedge',
  args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']
})
try {
  for(let round=firstRound;round<=rounds;round++){
    for(const profile of profiles){
      const mobile=profile==='mobile'
      const context=await browser.newContext(mobile?{
        isMobile:true,hasTouch:true,deviceScaleFactor:1,viewport:round===1?{width:844,height:390}:{width:390,height:844}
      }:{viewport:{width:890,height:550}})
      try {
        const page=await context.newPage()
        const errors=[]
        page.on('pageerror',error=>errors.push(error.message))
        page.on('console',msg=>{if(msg.type()==='error')console.log('Browser:',msg.text().slice(0,350))})
        page.setDefaultTimeout(55000)
        await page.addInitScript(()=>{
          if(self===top&&!localStorage.getItem('forgotten-island:settings:v1')){
            localStorage.setItem('forgotten-island:settings:v1',JSON.stringify({quality:'low'}))
          }
          const NativeAudio=window.Audio
          window.Audio=function(...args){
            const track=new NativeAudio(...args)
            window.tenerifeTestAudio=track
            return track
          }
        })
        await page.goto(mobile?(process.env.TENERIFE_MOBILE_URL??url):url)
        const press=locator=>mobile?locator.tap():locator.click()
        const entry=page.getByRole('button',{name:'Explorează Tenerife',exact:true})
        await press(entry)
        const frame=page.frameLocator('iframe[title="Ruta del Viento"]')
        const button=name=>frame.getByRole('button',{name,exact:true})
        const root=frame.locator('.drive-root')
        await press(button('Pornește la drum'))
        await frame.locator('[data-drive-state="driving"]').waitFor()
        console.log(round,profile,'route ready')
        await press(button('Pornește radioul'))
        await button('Oprește radioul').waitFor()
        assert.equal(await root.evaluate(()=>window.tenerifeTestAudio.paused),false)
        await press(button('Oprește radioul'))
        assert.equal(await root.evaluate(()=>window.tenerifeTestAudio.paused),true)
        const camera=async()=>{
          if(mobile)await press(button('Schimbă camera'))
          else await page.keyboard.press('KeyC')
        }
        await camera()
        await frame.locator('[data-drive-camera="1"]').waitFor()
        if(process.env.TENERIFE_SHOTS&&round===1){
          await page.screenshot({path:join(process.env.TENERIFE_SHOTS,profile+'-tenerife-cockpit.png'),timeout:55000})
        }
        await camera()
        await frame.locator('[data-drive-camera="2"]').waitFor()
        const cdp=mobile?await context.newCDPSession(page):null
        const center=await frame.locator('.drive-canvas').boundingBox()
        const x=Math.round(center.x+center.width*.48)
        const y=Math.round(center.y+center.height*.46)
        if(mobile){
          await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]})
          await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+90,y:y+30,id:1}]})
          await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
        }else{
          await page.mouse.move(x,y)
          await page.mouse.down()
          await page.mouse.move(x+90,y+30,{steps:6})
          await page.mouse.up()
        }
        await frame.locator('[data-camera-orbit]:not([data-camera-orbit="0"])').waitFor()
        console.log(round,profile,'radio, cockpit and orbit ready')
        const vehicle=async label=>mobile?press(button(label)):page.keyboard.press('KeyF')
        await vehicle('Coboară din mașină')
        await frame.locator('[data-exploration="walking"]').waitFor()
        const position=()=>root.evaluate(el=>({x:Number(el.dataset.walkerX),z:Number(el.dataset.walkerZ)}))
        const before=await position()
        const move=async (hold,forward=true)=>{
          if(!mobile){
            const key=forward?'KeyW':'KeyS'
            if(hold)await page.keyboard.down(key)
            else await page.keyboard.up(key)
          }else{
            if(!hold){
              await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
              return
            }
            const pedal=await frame.locator('.drive-pedals button').nth(forward?1:0).boundingBox()
            await cdp.send('Input.dispatchTouchEvent',{
              type:'touchStart',
              touchPoints:[{x:Math.round(pedal.x+pedal.width/2),y:Math.round(pedal.y+pedal.height/2),id:1}]
            })
          }
        }
        await move(true)
        try {
          await frame.getByRole('button',{name:/Adună · Scoica/}).waitFor()
        }finally{await move(false)}
        const after=await position()
        assert.ok(Math.hypot(before.x-after.x,before.z-after.z)>.001)
        await press(frame.getByRole('button',{name:/Adună · Scoica/}))
        assert.deepEqual(await root.evaluate(()=>JSON.parse(localStorage.getItem('insula.drive.ruta-viento.collection.v1'))),['shell'])
        await press(button('Colecția insulei'))
        await frame.getByRole('region',{name:'Colecția insulei'}).getByText('Scoica de la Playa del Viento',{exact:true}).waitFor()
        await press(button('Colecția insulei'))
        const distance=await root.evaluate(el=>Math.hypot(
          Number(el.dataset.walkerX)-Number(el.dataset.carX),
          Number(el.dataset.walkerZ)-Number(el.dataset.carZ)
        ))
        if(distance>2.8){
          const driveFrame=page.frames().find(child=>child.url()==='about:srcdoc')
          await move(true,false)
          try {
            await driveFrame.waitForFunction(()=>{
              const { walkerX,walkerZ,carX,carZ }=document.querySelector('.drive-root').dataset
              return Math.hypot(Number(walkerX)-Number(carX),Number(walkerZ)-Number(carZ))<2.35
            })
          }finally{await move(false,false)}
        }
        await vehicle('Urcă în mașină')
        await frame.locator('[data-exploration="driving"]').waitFor()
        await move(true)
        try {
          await frame.locator('[data-car-speed]:not([data-car-speed="0.0000"])').waitFor()
        }finally{await move(false)}
        await press(button('Hartă traseu'))
        await frame.getByRole('dialog',{name:'Harta traseului'}).getByText('Caleta Sur',{exact:true}).waitFor()
        await press(button('Înapoi la volan'))
        await press(button('Pune pauză'))
        await press(button('Meniu principal'))
        await entry.waitFor()
        assert.deepEqual(errors,[])
        console.log(round,profile,'walking, journal, driving and return passed')
      }finally{await context.close()}
    }
  }
}finally{await browser.close()}
