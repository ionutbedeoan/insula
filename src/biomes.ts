import { smooth, shore } from './world-data.ts'

// Wet catchment on the windward slope, drier volcanic shelves facing east.
export function biomeAt(x:number,z:number){
  const wet=Math.exp(-(((x+82)/107)**2+((z+7)/124)**2))
  const lava=smooth(104,174,x)*(1-.45*smooth(55,145,z))
  const beach=(1-smooth(5,31,shore(x,z)))*smooth(145,194,z)
  return {wet,lava,beach}
}
