import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { writeFile } from 'node:fs/promises'
import { createCanvas, type Canvas } from '@napi-rs/canvas'
import { JSDOM } from 'jsdom'
import { Puzzle } from '../src/puzzles.tsx'
import { IslandMap } from '../src/map.tsx'
import { answer, collect, emptyProgress } from '../src/progress.ts'
import { itemsById, puzzleIds, type PuzzleId } from '../src/content.ts'

const canvases=new WeakMap<HTMLCanvasElement,Canvas>()

function mount(){
  const dom=new JSDOM('<main id="root"></main>',{url:'http://localhost/'})
  Object.defineProperty(dom.window.HTMLCanvasElement.prototype,'getContext',{value:function(this:HTMLCanvasElement,type:string){
    if(type!=='2d')return null
    let target=canvases.get(this)
    if(target)return target.getContext('2d')
    target=createCanvas(this.width,this.height)
    canvases.set(this,target)
    const ctx=target.getContext('2d'), draw=ctx.drawImage.bind(ctx)
    ctx.drawImage=((source:HTMLCanvasElement,...args:number[])=>{
      const nativeSource=canvases.get(source)
      if(!nativeSource)throw new Error('Unexpected source canvas')
      Reflect.apply(draw,ctx,[nativeSource,...args])
    }) as typeof ctx.drawImage
    return ctx
  }})
  const globals={window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true}
  const saved=Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)] as const)
  for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,value})
  const root=createRoot(document.getElementById('root')!)
  const node=document.getElementById('root')!
  return {
    root,node,window:dom.window,pixels:(canvas:HTMLCanvasElement)=>canvases.get(canvas),
    click:async(label:string)=>{
      const element=[...node.querySelectorAll('button')].find(b=>b.textContent?.replace(/\s/g,' ').trim()===label||b.getAttribute('aria-label')===label)
      assert.ok(element,label+' button')
      assert.ok(!element.disabled,label+' is disabled')
      await act(async()=>element.click())
    },
    close:async()=>{
      await act(async()=>root.unmount())
      dom.window.close()
      for(const [key,v] of saved)v?Object.defineProperty(globalThis,key,v):Reflect.deleteProperty(globalThis,key)
    }
  }
}

test('Romanian game controls solve four mechanisms after wrong attempts, and the ending stays gated',async()=>{
  const ui=mount()
  let progress=emptyProgress()
  const puzzle=async(id:PuzzleId,language:'ro'|'en'='ro')=>{
    const display=()=>h(Puzzle,{key:id+language,id,language,progress,onClose:()=>{},onJournal:()=>{},onSubmit:(value:string)=>{
      const result=answer(progress,id,value)
      progress=result.progress
      ui.root.render(display())
      return result
    }})
    await act(async()=>ui.root.render(display()))
  }
  const click=ui.click
  try{
    await puzzle('tide')
    assert.match(ui.node.textContent??'',/Verifică mai întâi direcția/)
    assert.ok(!ui.node.querySelector('.tide-cycle'))

    progress=answer(progress,'lockbox','472').progress
    progress=collect(progress,itemsById.lens)
    progress=collect(progress,itemsById.lamp)
    progress=collect(progress,itemsById.keeper)
    await puzzle('relay')
    for(const name of ['Clopot de semnal','Soare puternic','Maree în scădere','Activează releul'])await click(name)
    assert.match(ui.node.textContent??'',/pocnește de două ori/)
    for(const name of ['Aer ascendent','Soare puternic','Maree în scădere','Activează releul'])await click(name)
    assert.match(ui.node.textContent??'',/Rezolvat/)

    await puzzle('repair')
    for(const name of ['Lampă indicatoare','Suport lat frontalLocaș liber','Lentilă obiectiv','Mufa reticululuiLocaș liber','Testează montajul'])await click(name)
    assert.match(ui.node.textContent??'',/monturi diferite/)
    await click('Scoate piesele')
    for(const name of ['Lentilă obiectiv','Suport lat frontalLocaș liber','Lampă indicatoare','Mufa reticululuiLocaș liber','Testează montajul'])await click(name)
    assert.match(ui.node.textContent??'',/Rezolvat/)

    progress=answer(progress,'sight','151').progress
    await puzzle('bearing')
    await click('E')
    await click('Înregistrează direcția')
    assert.match(ui.node.textContent??'',/nu trece prin stânca despicată/)
    await click('ESE')
    await click('Înregistrează direcția')
    assert.match(ui.node.textContent??'',/Rezolvat/)

    await puzzle('tide')
    await click('∧Maree înaltă')
    await click('Reglează roata mareei')
    assert.match(ui.node.textContent??'',/sare înapoi/)
    await click('↘Reflux')
    await click('Reglează roata mareei')
    assert.match(ui.node.textContent??'',/Ușa s-a deschis/)
    assert.deepEqual(progress.solved,puzzleIds)

    await puzzle('tide','en')
    assert.match(ui.node.textContent??'',/The door is open/)
  }finally{
    await ui.close()
  }
})

test('localized map controls zoom, center and return to an unpannable overview',async()=>{
  const ui=mount()
  try{
    const progress={...emptyProgress(),discovered:['beach','forest','camp','falls','ruins','tower','coast'] as const}
    const pose={x:23,z:193,yaw:.72,pitch:0}
    const npc={x:19,z:182,y:2.85,yaw:.7,walking:false,step:5,station:'beach' as const,task:'measure' as const,taskTime:0}
    await act(async()=>ui.root.render(h(IslandMap,{progress:{...progress,discovered:[...progress.discovered]},language:'ro',pose,npc})))
    const zoom=()=>ui.node.querySelector('.map-chart')?.getAttribute('data-zoom')
    assert.equal(zoom(),'1.00')
    const surface=ui.node.querySelector('canvas')
    assert.ok(surface)
    const chart=ui.pixels(surface)
    assert.ok(chart)
    const context=chart.getContext('2d')
    const sea=context.getImageData(33,111,1,1).data
    const land=context.getImageData(365,358,1,1).data
    assert.notDeepEqual(sea,land)
    const output=process.env.ISLAND_MAP_REVIEW
    if(output)await writeFile(output,chart.toBuffer('image/png'))
    await ui.click('Mărește harta')
    await ui.click('Mărește harta')
    assert.equal(zoom(),'1.69')
    await ui.click('Micșorează harta')
    assert.equal(zoom(),'1.30')
    await ui.click('Centrează harta')
    assert.equal(zoom(),'1.00')
    assert.ok(ui.node.querySelector<HTMLButtonElement>('[aria-label="Micșorează harta"]')?.disabled)
  }finally{
    await ui.close()
  }
})

test('optional tide gauge can be read fully through Romanian interface controls',async()=>{
  const {FieldPanel}=await import('../src/field-panel.tsx')
  const ui=mount()
  try{
    const records:import('../src/fieldwork.ts').FieldId[]=[]
    const display=()=>h(FieldPanel,{language:'ro',id:'tide-reading',records,
      onComplete:id=>{records.push(id);ui.root.render(display())},
      onClose:()=>{}
    })
    await act(async()=>ui.root.render(display()))
    await ui.click('Următoarea citire')
    await ui.click('Următoarea citire')
    assert.equal(ui.node.querySelectorAll('.tide-samples li').length,3)
    await ui.click('Flux')
    await ui.click('Notează observația')
    assert.match(ui.node.textContent??'',/Încearcă din nou/)
    await ui.click('Reflux')
    await ui.click('Notează observația')
    assert.deepEqual(records,['tide-reading'])
    assert.match(ui.node.textContent??'',/Înregistrat în carnetul de teren/)
  }finally{
    await ui.close()
  }
})
