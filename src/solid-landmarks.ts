import { eastShoreRocks, shoreRocks } from './landmarks.ts'
import { items } from './content.ts'
import { height, rng, shore, trailDistance } from './world-data.ts'

type Vector = [number,number,number]
type Rock = [position:Vector,size:Vector,color:string,turn:number]

export const fallenLogs = [[-34,155,7,1.2],[-39,125,10,1.77],[-66,107,9,2.3],[-96,-46,5,.33],[-117,-41,6,2.5],[-71,74,7,-1.3]] as const
export const forestLogs = [[-75,132,-66,127],[-43,145,-35,142],[-29.4,116,-36,111],[59,149,69,145]] as const

export const beachBoulders:Rock[]=shoreRocks.map(([x,z,rx,ry,rz])=>[
  [x,height(x,z)+ry*.27,z],[rx,ry,rz],ry>1?'#6f7872':'#838779',x,
])

export const ruinBoulders:Rock[]=[-9,-6.1,16.7,19].map(x=>[
  [x,22.49,-39+Math.sin(x)*5],[.72,.68,1.13],'#969783',x,
])

export function waterfallBoulders(){
  const rocks:Rock[]=[]
  const random=rng(502)
  for(let i=0;i<22;i++){
    const x=-124+i*1.34,z=-79+Math.sin(i*.55)*2,y=height(x,z)
    const h=3+random()*5+(1-Math.abs(i-8)/20)*6
    const basalt=['#596761','#686e66','#77786b','#505f56'][i%4]
    rocks.push([[x,y+h*.43,z],[3+random()*2,h*.69,3+random()*3],basalt,random()*3])
    if(i%2===0)rocks.push([[x+.5,y+h*.73,z-1.2],[2.4,2.6,3.2],'#819067',random()*4])
  }
  for(let i=0;i<29;i++){
    const a=i*Math.PI*2/29,x=-108+Math.cos(a)*8.1,z=-66+Math.sin(a)*6.15
    const shape=.29+random()*.47
    rocks.push([[x,height(x,z)+.09,z],[.43+random()*1.32,shape,.46+random()*1.06],i%2?'#657664':'#7a7b69',a])
  }
  for(const [x,z,y] of [[-119,-63,1.4],[-123,-73,3.8],[-126.5,-80,4],[-121,-96,4.7],[-132,-88,2.4],[-98,-69,2.5]]){
    rocks.push([[x,height(x,z)+y*.52,z],[2,y,3.3],'#768981',x])
  }
  return rocks
}

export function coastBoulders(){
  const rocks:Rock[]=[]
  const random=rng(832)
  for(let i=0;i<31;i++){
    const x=144+random()*57,z=-38+random()*68
    if(Math.abs(z-(-.5*(x-164)-6))<4 || Math.hypot(x-186,z+16)<8 || Math.hypot(x-140,z-15)<11 || Math.hypot(x-156,z-38)<16)continue
    const y=height(x,z),w=1.3+random()*4.3,h=1.5+random()*6
    rocks.push([[x,y+h*.35,z],[w,h,w*.86],i%2?'#7a8a85':'#9aa096',random()*6])
  }
  for(const [x,z,s] of [[182,-23,2.5],[187,-10,2.8],[194,-17,3.9],[144,-4,4.5],[148,22.5,3.4],[127,30.5,1.6]]){
    rocks.push([[x,height(x,z)+s*.48,z],[s,s*.85,s*1.13],'#798a85',x])
  }
  for(const [x,z,rx,ry,rz] of eastShoreRocks){
    rocks.push([[x,Math.max(.33,height(x,z))+ry*.17,z],[rx,ry,rz],ry>2.5?'#72766f':'#75796d',x*.59])
    if(ry>2.5)rocks.push([[x-.22,Math.max(.42,height(x,z))+ry*.28,z+.13],[rx*.86,ry*.64,rz*1.11],'#626d67',x*.44])
  }
  return rocks
}

export function basaltColumns(){
  const random=rng(5169)
  const columns=[]
  for(const [cx,cz,count] of [[210,-29,23],[222,-29,29],[227,33,23],[234,37,17],[200,-46,21],[137,-71,14]]){
    for(let i=0;i<count;i++){
      const x=cx+(random()-.5)*20,z=cz+(random()-.5)*15
      if(shore(x,z)<-5||trailDistance(x,z)<4.5||items.some(item=>Math.hypot(x-item.x,z-item.z)<5))continue
      columns.push({x,z,r:.54+random()*1.55,h:1.2+random()*5.8,seed:Math.floor(random()*2**30)})
    }
  }
  return columns
}
