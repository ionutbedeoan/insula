import { shoreRadius } from './world-data.ts'

export const chartOffset={x:39,y:-28}
export const chartRange=52
export const chartPins=[[94,159],[227,72]] as const

const outline=Array.from({length:144},(_,i)=>{
  const angle=i/144*2*Math.PI
  const radius=shoreRadius(angle)*.30
  return [160+Math.cos(angle)*radius,112+Math.sin(angle)*radius].map(value=>value.toFixed(1)).join(',')
})
export const chartCoast=outline.join(' ')

export function chartsMatch(x:number,y:number){
  return Math.hypot(x,y)<=4
}
