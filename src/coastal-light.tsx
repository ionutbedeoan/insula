import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as T from 'three'

function skyProbe(){
  const w=128,h=64,pixels=new Uint16Array(w*h*4)
  const horizon=new T.Color('#cdd8d1'), zenith=new T.Color('#719abd'), lower=new T.Color('#514839')
  const sun=new T.Vector3(-.499,.621,-.603).normalize()
  const color=new T.Color()
  for(let row=0;row<h;row++)for(let col=0;col<w;col++){
    const theta=Math.PI*(row+.5)/h, phi=Math.PI*2*(col+.5)/w
    const sy=Math.cos(theta),sx=-Math.sin(theta)*Math.cos(phi),sz=Math.sin(theta)*Math.sin(phi)
    color.copy(horizon).lerp(sy>0?zenith:lower,Math.pow(Math.abs(sy),.44))
    const glare=Math.max(0,sx*sun.x+sy*sun.y+sz*sun.z)**72
    color.r+=glare*4.3;color.g+=glare*3.4;color.b+=glare*1.8
    const i=(row*w+col)*4
    pixels[i]=T.DataUtils.toHalfFloat(color.r)
    pixels[i+1]=T.DataUtils.toHalfFloat(color.g)
    pixels[i+2]=T.DataUtils.toHalfFloat(color.b)
    pixels[i+3]=T.DataUtils.toHalfFloat(1)
  }
  const map=new T.DataTexture(pixels,w,h,T.RGBAFormat,T.HalfFloatType)
  map.mapping=T.EquirectangularReflectionMapping
  map.colorSpace=T.LinearSRGBColorSpace
  map.needsUpdate=true
  return map
}
export function CoastalLight(){
  const scene=useThree(state=>state.scene)
  useEffect(()=>{
    const texture=skyProbe()
    const oldEnvironment=scene.environment
    const oldIntensity=scene.environmentIntensity
    scene.environment=texture
    scene.environmentIntensity=.45
    return ()=>{
      scene.environment=oldEnvironment
      scene.environmentIntensity=oldIntensity
      texture.dispose()
    }
  },[scene])
  return null
}
