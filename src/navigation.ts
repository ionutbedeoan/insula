import { notchRocks, openingStumps, surfRocks } from './opening-layout.ts'
import { basaltColumns, beachBoulders, coastBoulders, fallenLogs, forestLogs, ruinBoulders, waterfallBoulders } from './solid-landmarks.ts'
import { plants, treeProfile, treeSpecies } from './vegetation-layout.ts'
import { floor, height, isGroundWalkable, tower } from './world-data.ts'

const cellSize=8
const playerRadius=.32
const stepLength=.14

type Obstacle = {
  x:number;z:number;rx:number;rz:number;cos:number;sin:number;halfLength:number;
  kind:'trunk'|'rock'|'log';
}
const grid=new Map<number,Obstacle[]>()
const cellKey=(x:number,z:number)=>x*1024+z

function addObstacle(x:number,z:number,rx:number,rz:number,turn:number,kind:Obstacle['kind'],halfLength=0){
  const radius=Math.max(rx,rz)+halfLength+playerRadius
  const obstacle={x,z,rx,rz,cos:Math.cos(turn),sin:Math.sin(turn),halfLength,kind}
  for(let cx=Math.floor((x-radius)/cellSize);cx<=Math.floor((x+radius)/cellSize);cx++){
    for(let cz=Math.floor((z-radius)/cellSize);cz<=Math.floor((z+radius)/cellSize);cz++){
      const id=cellKey(cx,cz)
      let cell=grid.get(id)
      if(!cell){cell=[];grid.set(id,cell)}
      cell.push(obstacle)
    }
  }
}
for(const plant of plants.palm)addObstacle(plant.x,plant.z,plant.s*.36,plant.s*.36,plant.turn,'trunk')
for(const plant of plants.tree){
  const radius=plant.s*treeProfile[treeSpecies(plant)].radius
  addObstacle(plant.x,plant.z,radius,radius,plant.turn,'trunk')
}
for(const plant of plants.rock){
  if(plant.s*(plant.squash*.89-.24)<.3)continue
  addObstacle(plant.x,plant.z,plant.s*.88,plant.s*.88,plant.turn,'rock')
}
for(const [[x,y,z],[rx,ry,rz],,turn] of [...beachBoulders,...coastBoulders(),...waterfallBoulders(),...ruinBoulders]){
  const elevation=y-height(x,z)
  if(elevation+ry*.88<.31||elevation-ry>.9)continue
  const crossSection=Math.sqrt(1-Math.min(.64,(elevation/ry)**2))
  addObstacle(x,z,rx*.91*crossSection,rz*.9*crossSection,turn,'rock')
}
for(const {x,z,r,h} of basaltColumns()){
  if(h*.67>.36)addObstacle(x,z,r*.99,r*.99,0,'rock')
}
for(const [x,z,length,turn] of fallenLogs)addObstacle(x,z,.28,.28,-turn,'log',length*.5)
for(const [ax,az,bx,bz] of forestLogs)addObstacle(
  (ax+bx)/2,(az+bz)/2,.49,.49,Math.atan2(az-bz,bx-ax),'log',Math.hypot(bx-ax,bz-az)/2,
)

for(const {x,z,w,d,yaw} of openingStumps)addObstacle(x,z,w*.32,d*.32,yaw,'trunk')
for(const {x,z,w,d,yaw} of notchRocks)addObstacle(x,z,w*.41,d*.41,yaw,'rock')
for(const {x,z,r,yaw} of surfRocks)addObstacle(x,z,r*.83,r*.60,yaw,'rock')

export function sceneryObstacleAt(x:number,z:number){
  const cell=grid.get(cellKey(Math.floor(x/cellSize),Math.floor(z/cellSize)))
  if(!cell)return undefined
  return cell.find(o=>{
    const dx=x-o.x,dz=z-o.z
    const localX=dx*o.cos-dz*o.sin,localZ=dx*o.sin+dz*o.cos
    const axisDistance=Math.max(0,Math.abs(localX)-o.halfLength)
    return (axisDistance/(o.rx+playerRadius))**2+(localZ/(o.rz+playerRadius))**2<1
  })
}

export function canWalk(x:number,z:number,unlocked:boolean){
  return isGroundWalkable(x,z,unlocked)&&!sceneryObstacleAt(x,z)
}

export function walk(fromX:number,fromZ:number,dx:number,dz:number,unlocked:boolean,jumping:boolean){
  let x=fromX,z=fromZ
  if(!dx&&!dz)return {x,z}
  const count=Math.ceil(Math.hypot(dx,dz)/stepLength)
  const stepX=dx/count,stepZ=dz/count
  const minimumSlide=Math.hypot(stepX,stepZ)*.13
  const clearance=jumping?.54:.36
  const viable=(nextX:number,nextZ:number)=>{
    if(!canWalk(nextX,nextZ,unlocked))return false
    const elevation=floor(x,z)
    const leavingPlatform=elevation>=tower.top-.12 && z<tower.front && z>=tower.back && Math.abs(x-tower.x)<2.25
    if(leavingPlatform&&nextZ<tower.front&&(Math.abs(nextX-tower.x)>2.12||nextZ<tower.back+.12))return false
    return floor(nextX,nextZ)-elevation<clearance
  }
  for(let i=0;i<count;i++){
    if(viable(x+stepX,z+stepZ)){
      x+=stepX;z+=stepZ
      continue
    }
    const obstacle=sceneryObstacleAt(x+stepX,z+stepZ)
    if(obstacle){
      // Slide along the actual contact tangent, including oblique capsule edges.
      const {cos,sin,rx,rz,halfLength}=obstacle
      const dx=x-obstacle.x,dz=z-obstacle.z
      const localX=dx*cos-dz*sin,localZ=dx*sin+dz*cos
      const nx=(localX-Math.max(-halfLength,Math.min(halfLength,localX)))/(rx+playerRadius)**2
      const nz=localZ/(rz+playerRadius)**2
      const length=Math.hypot(nx,nz)
      if(length>0){
        const normalX=(nx*cos+nz*sin)/length,normalZ=(-nx*sin+nz*cos)/length
        const inward=stepX*normalX+stepZ*normalZ
        if(inward<0){
          const tangentX=stepX-normalX*inward,tangentZ=stepZ-normalZ*inward
          if(Math.hypot(tangentX,tangentZ)>minimumSlide&&viable(x+tangentX,z+tangentZ)){
            x+=tangentX;z+=tangentZ
            continue
          }
        }
      }
    }
    if(stepX&&viable(x+stepX,z))x+=stepX
    if(stepZ&&viable(x,z+stepZ))z+=stepZ
  }
  return {x,z}
}

export function recoverSavedPosition(x:number,z:number,unlocked:boolean){
  if(!isGroundWalkable(x,z,unlocked))return undefined
  if(!sceneryObstacleAt(x,z))return {x,z}
  for(let radius=.2;radius<=6;radius+=.2){
    const count=Math.ceil(Math.PI*2*radius/.2)
    for(let i=0;i<count;i++){
      const angle=i/count*Math.PI*2
      const nx=x+Math.cos(angle)*radius,nz=z+Math.sin(angle)*radius
      if(Math.abs(floor(nx,nz)-floor(x,z))>1.7)continue
      if(!unlocked&&nx>=158&&nx<178&&nz>33&&nz<43)continue
      if(canWalk(nx,nz,unlocked))return {x:nx,z:nz}
    }
  }
  return undefined
}
