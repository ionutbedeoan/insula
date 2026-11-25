import { items, type Item } from './content.ts'
import { objectAvailable, type Progress } from './progress.ts'
import type { Runtime } from './runtime.ts'
import { archive, floor, tower } from './world-data.ts'

export function bestTarget(world:Runtime,progress:Progress):Item|null{
  const {x,z,yaw}=world.pose
  const feet=world.y
  const inside=x>archive.entryX+.35 && x<archive.backX && Math.abs(z-archive.z)<4.18
  const facingX=-Math.sin(yaw),facingZ=-Math.cos(yaw)
  let current:Item|null=null, best=-Infinity
  for(const item of items){
    if(!objectAvailable(progress,item))continue
    if(item.area==='archive' && !inside)continue
    if(item.id==='tower-view' && feet<tower.top-.7)continue
    const dx=item.x-x,dz=item.z-z,d=Math.hypot(dx,dz)
    if(d>(item.reach??3.8))continue
    const elevation=(item.lift??0)+floor(item.x,item.z)
    const y=(item.lift&&item.area==='tower')?tower.top:elevation
    if(Math.abs(feet-y)>2.1)continue
    const dot=d>.05?(dx*facingX+dz*facingZ)/d:1
    if(dot<(d<1.05?-.28:item.kind==='view'||item.kind==='secret'?.12:.38))continue
    const score=dot*2.8-d*.19+(item.kind==='view'||item.kind==='secret'?-.32:0)
    if(score>best){best=score;current=item}
  }
  return current
}
