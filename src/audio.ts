import { biomeAt } from './biomes.ts'
import { distance, shore, trailDistance } from './world-data.ts'

class IslandAudio {
  private ctx?:AudioContext
  private master?:GainNode
  private sea?:GainNode
  private falls?:GainNode
  private wind?:GainNode
  private canopy?:GainNode
  private waterfallPan?:StereoPannerNode
  private lastAmbience=0
  private buffer?:AudioBuffer
  private volume=.48
  private lastStep=0
  private nextBird=0

  async start(){
    try {
      if(!this.ctx) this.build()
      if(this.ctx?.state==='suspended') await this.ctx.resume()
    } catch { /* Gameplay remains available on browsers with audio disabled. */ }
  }
  suspend(){
    void this.ctx?.suspend().catch(()=>{})
  }
  private build(){
    const ctx=new AudioContext()
    this.ctx=ctx
    this.master=ctx.createGain()
    this.master.gain.value=this.volume*.48
    this.master.connect(ctx.destination)
    const buffer=ctx.createBuffer(1,ctx.sampleRate*5,ctx.sampleRate)
    const data=buffer.getChannelData(0)
    let noise=0
    for(let i=0;i<data.length;i++){ noise=(noise+Math.random()*.035-.0175)/1.035;data[i]=noise*3.3+(Math.random()-.5)*.075 }
    this.buffer=buffer
    const ambience=(frequency:number,type:BiquadFilterType='lowpass',destination:AudioNode=this.master!)=>{
      const source=ctx.createBufferSource(), filter=ctx.createBiquadFilter(), gain=ctx.createGain()
      source.buffer=buffer
      source.loop=true
      filter.type=type
      filter.frequency.value=frequency
      gain.gain.value=0
      source.connect(filter).connect(gain).connect(destination)
      source.start()
      return gain
    }
    this.waterfallPan=ctx.createStereoPanner()
    this.waterfallPan.connect(this.master)
    this.sea=ambience(590)
    this.falls=ambience(1860,'lowpass',this.waterfallPan)
    this.wind=ambience(320,'bandpass')
    this.canopy=ambience(3240,'bandpass')
    this.nextBird=ctx.currentTime+5
  }
  setVolume(value:number){
    this.volume=value
    if(this.ctx && this.master) this.master.gain.setTargetAtTime(value*.48,this.ctx.currentTime,.1)
  }
  update(x:number,z:number,yaw:number,moving:boolean,run:boolean,live:boolean){
    if(!this.ctx || !this.sea || !this.falls || this.ctx.state!=='running') return
    const t=this.ctx.currentTime, edge=shore(x,z)
    if(t-this.lastAmbience>.07){
      this.lastAmbience=t
      const fallsDistance=distance(x,z,[-108,-66])
      const waterfallVolume=live?Math.max(0,1-fallsDistance/56)**1.38*.79:0
      const surf=(.12+.56*Math.exp(-edge/31))*(.77+.2*Math.sin(t*.69)+.085*Math.sin(t*1.21))
      this.sea.gain.setTargetAtTime((live?1:.56)*surf,t,.32)
      this.falls.gain.setTargetAtTime(waterfallVolume,t,.38)
      const wet=biomeAt(x,z).wet
      this.canopy?.gain.setTargetAtTime(live?wet*.046*(.7+.3*Math.sin(t*.88)**2):0,t,.45)
      this.wind?.gain.setTargetAtTime((live?.22:.12)*(.68+.19*Math.sin(t*.17)+.12*Math.sin(t*.51)),t,.72)
      if(waterfallVolume>0){
        const pan=((-108-x)*Math.cos(yaw)+(-66-z)*-Math.sin(yaw))/Math.max(8,fallsDistance)
        this.waterfallPan?.pan.setTargetAtTime(Math.max(-.84,Math.min(.84,pan)),t,.28)
      }
    }
    if(live && moving && t-this.lastStep>(run?.31:.47)) {
      this.lastStep=t
      const source=this.ctx.createBufferSource(),filter=this.ctx.createBiquadFilter(),gain=this.ctx.createGain()
      source.buffer=this.buffer!
      filter.type='bandpass';filter.frequency.value=edge<23?515:trailDistance(x,z)<2.2?380:248
      gain.gain.setValueAtTime(.23,t);gain.gain.exponentialRampToValueAtTime(.002,t+.115)
      source.connect(filter).connect(gain).connect(this.master!)
      source.start(t,Math.random()*3,.14)
    }
    if(live && t>this.nextBird && edge>28){
      this.nextBird=t+9+Math.random()*13
      const pitch=biomeAt(x,z).wet>.5?1.16:.79
      this.tone(1940*pitch,2420*pitch,t,.12,.021)
      this.tone(1740*pitch,1350*pitch,t+.15,.15,.018)
      if(pitch>1)this.tone(1690,2340,t+.32,.086,.014)
    }
  }
  chime(success:boolean){
    if(!this.ctx) return
    const t=this.ctx.currentTime
    this.tone(success?523:220,success?630:175,t,.18,.1)
    if(success) this.tone(784,840,t+.095,.29,.076)
  }
  private tone(from:number,to:number,t:number,length:number,volume:number){
    const ctx=this.ctx!
    const oscillator=ctx.createOscillator(), gain=ctx.createGain()
    oscillator.type='sine'
    oscillator.frequency.setValueAtTime(from,t)
    oscillator.frequency.exponentialRampToValueAtTime(to,t+length)
    gain.gain.setValueAtTime(.001,t)
    gain.gain.exponentialRampToValueAtTime(volume,t+.022)
    gain.gain.exponentialRampToValueAtTime(.001,t+length)
    oscillator.connect(gain).connect(this.master!)
    oscillator.start(t);oscillator.stop(t+length+.02)
  }
}
export const islandAudio=new IslandAudio()
