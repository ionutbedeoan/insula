import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { scanBeachRocks, scanForestLogs } from './opening-layout.ts'
import { fieldCabins } from './landmarks.ts'
import { beachBoulders, coastBoulders, forestLogs, ruinBoulders, waterfallBoulders } from './solid-landmarks.ts'
import { shorelineRock } from './foliage-geometry.ts'
import { islandMaterial } from './island-materials.ts'
import { Waterfall } from './water.tsx'
import { items, type Item } from './content.ts'
import { archive, height, paths, rng, scope, tower, type Point } from './world-data.ts'
import { has, objectAvailable, solved, type Progress } from './progress.ts'

type Vec = [number,number,number]
const UP=new T.Vector3(0,1,0)
const unitBox=new T.BoxGeometry().toNonIndexed()
const rockProfiles=[shorelineRock(868,1),shorelineRock(247,2),shorelineRock(606,2)]
const unitLog=new T.CylinderGeometry(1,1,1,8).toNonIndexed()
const unitCone=new T.CylinderGeometry(.72,1,1,8).toNonIndexed()
const plank='#816748', gold='#dfa24c', sandstone='#b6a38a', stone='#7b837a'
const hinges='#374247', dark='#38444a'
const yAt=(x:number,z:number)=>height(x,z)
class Painter{
  private pieces:T.BufferGeometry[]=[]
  private random:()=>number
  constructor(seed:number){this.random=rng(seed)}
  shape(source:T.BufferGeometry,position:Vec,scale:Vec,color:string,rotation:T.Euler|T.Quaternion=new T.Euler()){
    const geo=source.clone()
    geo.scale(...scale)
    if(rotation instanceof T.Euler)geo.rotateX(rotation.x).rotateZ(rotation.z).rotateY(rotation.y)
    else geo.applyQuaternion(rotation)
    geo.translate(...position)
    const c=new T.Color(color).multiplyScalar(.94+this.random()*.12)
    const colors=new Float32Array(geo.attributes.position.count*3)
    for(let i=0;i<colors.length;i+=3)colors.set([c.r,c.g,c.b],i)
    geo.setAttribute('color',new T.BufferAttribute(colors,3))
    this.pieces.push(geo)
  }
  box(position:Vec,size:Vec,color:string,turn=0,tilt=0){this.shape(unitBox,position,size,color,new T.Euler(0,turn,tilt))}
  rock(position:Vec,size:Vec,color=stone,turn=0){this.shape(rockProfiles[Math.min(2,Math.floor(this.random()*3))],position,size,color,new T.Euler(.09,turn,.12))}
  beam(a:Vec,b:Vec,radius:number,color=plank,round=false){
    const direction=new T.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2])
    const length=direction.length()
    const mid:Vec=[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2]
    this.shape(round?unitLog:unitBox,mid,[radius,length,radius],color,new T.Quaternion().setFromUnitVectors(UP,direction.normalize()))
  }
  slab(a:Vec,b:Vec,c:Vec,d:Vec,color:string){
    const geo=new T.BufferGeometry()
    geo.setAttribute('position',new T.Float32BufferAttribute([...a,...b,...c,...a,...c,...d],3))
    geo.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,1,1,0,0,1,1,0,1],2))
    geo.computeVertexNormals()
    this.shape(geo,[0,0,0],[1,1,1],color)
    geo.dispose()
  }
  crate(x:number,z:number,width=1.1){
    const y=yAt(x,z)
    this.box([x,y+.42,z],[width,.84,width*.84],'#8b7653')
    for(const dx of [-.4,.4])for(const dz of [-.37,.37])this.box([x+dx*width,y+.46,z+dz*width],[.14,.92,.14],'#b29867')
    for(const dz of [-.43,.43])for(const dy of [.12,.72])this.box([x,y+dy,z+dz*width],[width,.13,.045],'#a89062')
    for(const dx of [-.23,0,.23])this.box([x+dx*width,y+.86,z],[.024,.018,width*.83],'#6a5c43')
  }
  table(x:number,z:number,w:number,d:number,ground=yAt(x,z)){
    this.box([x,ground+1,z],[w,.15,d],'#927957')
    for(const dx of [-1,1])for(const dz of [-1,1])this.box([x+dx*(w/2-.12),ground+.46,z+dz*(d/2-.1)],[.13,.92,.13],plank)
    for(let i=1;i<=3;i++)this.box([x,ground+1.078,z-d/2+i*d/4],[w,.014,.018],'#665941')
  }
  cairn(x:number,z:number,count=3){
    const y=yAt(x,z)
    for(let i=0;i<count;i++)this.rock([x+Math.sin(i)*.09,y+.12+i*.28,z],[.68-i*.1,.26,.48-i*.063],i===count-1?'#d5b674':sandstone,i*.7)
  }
  marker(x:number,z:number,tall=1.8){
    const y=yAt(x,z)
    this.beam([x,y,z],[x,y+tall,z],.15,'#9b7851')
    this.box([x+.17,y+tall-.18,z],[.62,.26,.085],gold)
    this.box([x+.21,y+tall-.18,z-.045],[.29,.026,.013],'#694b26')
  }
  rope(points:Vec[],color='#8b7b5d',radius=.036){
    for(let i=1;i<points.length;i++)this.beam(points[i-1],points[i],radius,color,true)
  }
  finish(){
    const geo=mergeGeometries(this.pieces)
    this.pieces.forEach(piece=>piece.dispose())
    return geo
  }
}

function beach(){
  const p=new Painter(95)
  const bx=17,bz=190,by=yAt(bx,bz)+.12
  const keel:Vec=[bx,by,bz]
  const dirt=new T.Color('#4b645a')
  const rand=rng(184)
  const hull:Point[]=[[0,-3.4],[-.94,-2.68],[-1.6,-.9],[-1.63,1.28],[-.96,2.71],[.92,2.71],[1.62,1.28],[1.58,-.9],[.92,-2.66],[0,-3.4]]
  for(let i=0;i<hull.length-1;i++){
    const [x,z]=hull[i],[nx,nz]=hull[i+1]
    const upperA:Vec=[bx+x,by+.79+(i===0?.17:0),bz+z],upperB:Vec=[bx+nx,by+.79+(i===8?.17:0),bz+nz]
    const lowerA:Vec=[bx+x*.73,by+.1,bz+z*.92],lowerB:Vec=[bx+nx*.73,by+.1,bz+nz*.92]
    const seam=(a:Vec,b:Vec,u:number):Vec=>[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u]
    for(let line=0;line<5;line++){
      const d=line/5,end=(line+1)/5-.015
      const color=dirt.clone().lerp(new T.Color(line<2?'#678679':'#5e7566'),rand()*.83).getStyle()
      p.slab(seam(upperA,lowerA,d),seam(upperB,lowerB,d),seam(upperB,lowerB,end),seam(upperA,lowerA,end),color)
      if(line%2===0)p.beam(seam(upperA,lowerA,end),seam(upperB,lowerB,end),.025,'#405a51')
    }
    const a:Vec=[upperA[0],upperA[1]-.26,upperA[2]],b:Vec=[upperB[0],upperB[1]-.26,upperB[2]]
    p.beam(a,b,.038,'#c6bc96');p.beam(upperA,upperB,.14,'#72563e')
    p.slab(keel,keel,lowerA,lowerB,'#815d46')
  }
  for(const z of [-1.5,.04,1.62])p.box([bx,by+.5,bz+z],[2.52,.12,.44],'#aa8b5d')
  for(const x of [-.56,0,.56])p.box([bx+x,by+.13,bz],[.5,.07,4.36],'#98754e')
  p.box([bx+.35,by+.32,bz+1.91],[.57,.53,.52],'#414c46',.13)
  p.beam([bx+.8,by+.65,bz-1.15],[bx+.17,by+1.02,bz+2.27],.062,'#ae8756',true)
  p.box([bx+.85,by+.6,bz-1.36],[.31,.06,.7],'#b59360',-.17)
  for(const [x,z,s] of [[26,182,1.35],[29,183,.85],[33,188,1.4],[31.5,189,.7],[8,200,.7]]) p.crate(x,z,s)
  const dockX=12
  for(let i=0;i<26;i++){
    const z=207+i*.59
    if(i===19||i>23&&i%2===0)continue
    p.box([dockX+Math.sin(i)*.035,2.18+Math.sin(i*.23)*.04,z],[3.35,.14,.56],i%4===0?'#b49a71':'#9c815e',Math.sin(i)*.045)
    if(i%4===0) for(const x of [dockX-1.31,dockX+1.31]){
      p.beam([x,-.2,z],[x,2.72,z],.19,'#755f47',true)
      p.box([x,2.56,z],[.23,.09,.23],'#c0ad84')
    }
  }
  for(const [x,z] of [[9,207],[42,192],[30,178]])p.cairn(x,z,2)
  for(const [x,z] of [[20,174],[10,161],[-9,148]])p.marker(x,z)
  p.rope([[bx+.9,by+.69,bz+.31],[bx+1.7,by+.33,bz+.78],[20,2.866,191.3],[21,2.867,191.8],[21.9,2.866,191.8],[22.7,2.866,192.05],[23.48,2.866,192.45],[24.2,2.871,193.1]],'#a9825d')
  for(const [index,rock] of beachBoulders.entries())if(!scanBeachRocks.some(scan=>scan===index))p.rock(...rock)
  for(let i=0;i<115;i++){
    const x=2+rand()*49,z=178+rand()*29, y=yAt(x,z)
    if(z<186&&x>18&&x<29 || Math.hypot(x-bx,z-bz)<4)continue
    const scale=.025+rand()**2*.12
    if(i%10===0)p.beam([x,y+.035,z],[x+rand()*.91,y+.08,z-.05-rand()*.38],.037,'#8f7d62',true)
    else p.rock([x,y+.024,z],[scale,scale*.47,scale*.76],i%3===0?'#cac2aa':'#8a8980',x)
  }
  for(const sx of [-1.28,1.28])for(let i=0;i<24;i++){
    const z=207+i*.59
    if(i===19)continue
    p.box([dockX+sx,2.258,z],[.044,.016,.046],'#66635a')
  }
  return p.finish()
}

function tentSheet(side:number,u:number,v:number):Vec{
  const x=-78,z=61,y=yAt(x,z)
  const fold=(.19+.18*Math.sin(v*7.1)**2+.045*Math.sin(v*29+u*8))*Math.sin(Math.PI*u)
  return [x+u*5*side,y+4.8-u*4.68-fold,z+v*6.98-3.49]
}
function campCanvas(){
  const p=new Painter(2322)
  for(const side of [-1,1]){
    for(let row=0;row<18;row++)for(let panel=0;panel<18;panel++){
      const a=row/18,b=(row+1)/18,c=panel/18,d=(panel+1)/18
      const shade=row>14?'#9c7857':panel%6===0?'#b9885e': side===1?'#b8895d':'#a47552'
      p.slab(tentSheet(side,a,c),tentSheet(side,b,c),tentSheet(side,b,d),tentSheet(side,a,d),shade)
    }
  }
  return p.finish()
}
function camp(){
  const p=new Painter(33)
  const x=-78,z=61,y=yAt(x,z)
  for(const dz of [-3.1,3.1]){
    const a:Vec=[x-5,y,z+dz],b:Vec=[x,y+4.9,z+dz],c:Vec=[x+5,y,z+dz]
    p.beam(a,b,.18);p.beam(c,b,.18)
    p.beam([x,y,z+dz],b,.17)
  }
  for(const side of [-1,1]){
    for(const v of [0,.25,.5,.75,1]){
      p.rope([tentSheet(side,0,v),tentSheet(side,.32,v),tentSheet(side,.7,v),tentSheet(side,1,v)],'#75624a',.020)
    }
    for(const t of [.15,.49,.81]){
      const a=tentSheet(side,t,0), b=tentSheet(side,t,1)
      p.beam(tentSheet(side,t,.03),tentSheet(side,t,.12),.019,'#bc9062',true)
      p.beam(a,tentSheet(side,t,.028),.019,'#b48a60',true)
      p.beam(b,tentSheet(side,t,.97),.019,'#9b774f',true)
    }
  }
  for(let i=0;i<=6;i++)p.beam([x-4.9,y+.19,z-3.1+i*1.03],[x+4.9,y+.19,z-3.1+i*1.03],.2,'#927658')
  for(const side of [-1,1])for(const dz of [-3.45,3.45])p.beam([x+side*3.7,y+1.27,z+dz],[x+side*6.65,y+.02,z+dz*1.14],.04,'#ae9870',true)
  p.beam([x,y+4.87,z-3.75],[x,y+4.87,z+3.75],.15,'#65583e')
  p.table(-71,58,3.05,1.6)
  p.table(-64.5,59.95,3.82,1.48)
  p.table(-62,64,1.45,.9)
  const roofX=-67,roofZ=51,roofY=yAt(roofX,roofZ)
  for(const dx of [-2.4,2.4])for(const dz of [-1.87,1.87])p.beam([roofX+dx,roofY,roofZ+dz],[roofX+dx,roofY+2.5+(dz>0?.5:0),roofZ+dz],.17)
  p.slab([roofX-3,roofY+2.47,roofZ-2.4],[roofX+3,roofY+2.47,roofZ-2.4],[roofX+3,roofY+3.08,roofZ+2.4],[roofX-3,roofY+3.08,roofZ+2.4],'#7c8270')
  for(const [cx,cz,s] of [[-69,50,1.55],[-64,51,1.25],[-73.5,65,1.04],[-74.5,64.8,.78],[-62,56,.9]])p.crate(cx,cz,s)
  p.box([-71.4,15.09,58.47],[.78,.018,.49],'#d9bd88',.2)
  for(const [px,pz] of [[-64.4,58.9],[-71.65,57.68],[-62.41,64.18]]){
    p.beam([px,15.09,pz],[px,15.41,pz],.062,'#4d5a52',true)
    p.beam([px,15.20,pz],[px,15.34,pz],.075,'#a49c76',true)
  }
  p.beam([-70.19,15.13,58.4],[-69.86,15.15,57.94],.047,'#423f39',true)
  p.box([-69.92,15.16,58.33],[.34,.069,.25],'#646c58',.53)
  for(const [px,pz] of [[-81,60.4],[-83.1,58.2],[-80.5,62.2]])p.crate(px,pz,.84)
  p.table(-79.5,61.5,2.2,1.1)
  for(const xx of [-79.95,-79.6,-79.24])p.beam([xx,15.11,61.5],[xx,15.44,61.5],.12,'#625c44',true)
  for(const [x,z] of [[-54,89],[-65,75],[-90,19],[-149,72]])p.marker(x,z)
  return p.finish()
}
function forest(){
  const p=new Painter(200)
  for(const [index,[ax,az,bx,bz]] of forestLogs.entries()){
    if(scanForestLogs.some(scan=>scan===index))continue
    p.beam([ax,yAt(ax,az)+.47,az],[bx,yAt(bx,bz)+.51,bz],.52,'#8a7651',true)
    p.beam([bx,yAt(bx,bz)+.51,bz],[bx+.17,yAt(bx,bz)+.52,bz],.34,'#b69a62',true)
  }
  for(const [x,z] of [[-24,133],[-34,121],[-44,110],[78,119],[101,94],[104,-145],[-77,125]])p.marker(x,z)
  for(const [x,z] of [[-74,124],[-78,123],[104,-156]])p.cairn(x,z)
  p.crate(-78,123,.66)
  return p.finish()
}
function fallsRocks(){
  const p=new Painter(87)
  for(const rock of waterfallBoulders())p.rock(...rock)
  for(const [x,z] of [[-110,-57],[-124,-57],[-128,-91],[-130,-52]])p.marker(x,z,1.52)
  p.table(-127,-94,1.8,1.2)
  return p.finish()
}
function ruins(){
  const p=new Painter(84)
  const y=22
  for(let i=0;i<4;i++)p.box([4,y+.16+i*.14,-24.5-i*.55],[10-i*.82,.3+i*.23,.79],i%2?sandstone:'#b39f81')
  for(const x of [-4,1.8,8.2,14]){
    p.box([x,y+.22,-45],[2.28,.44,2.1],'#b3a690')
    for(let i=0;i<5;i++)p.box([x+.04*Math.sin(i),y+.82+i*.9,-45],[1.43-.042*i,.88,1.52-.037*i],i%2?'#9ca294':'#b4ad97',i*.026)
    p.box([x,y+5,-45],[1.76,.35,1.68],'#b6a18a')
  }
  for(const x of [-1.1,5,11.1]){
    for(let i=0;i<9;i++){
      const a=(i+.5)*Math.PI/9
      const radii=[2.58,3.0],z=-45
      const ring=(r:number,side:number,d:number):Vec=>[x+Math.cos(a+side*.169)*r,y+4.94+Math.sin(a+side*.169)*r,z+d]
      const tint=i%3===1?'#aaa28d':sandstone
      p.slab(ring(radii[0],-1,.77),ring(radii[1],-1,.77),ring(radii[1],1,.77),ring(radii[0],1,.77),tint)
      p.slab(ring(radii[0],1,-.74),ring(radii[1],1,-.74),ring(radii[1],-1,-.74),ring(radii[0],-1,-.74),tint)
      for(const r of radii)p.slab(ring(r,-1,-.74),ring(r,-1,.77),ring(r,1,.77),ring(r,1,-.74),tint)
      for(const side of [-1,1])p.slab(ring(radii[0],side,-.74),ring(radii[1],side,-.74),ring(radii[1],side,.77),ring(radii[0],side,.77),tint)
    }
    p.box([x,y+7.78,-44.17],[.35,.26,.14],'#bd8d63')
  }
  for(const x of [-4,14])for(let i=0;i<5;i++)for(let j=0;j<(i<3?3:i<4?2:1);j++)
    p.box([x,y+.4+j*.66,-42+i*1.37+(j%2)*.22],[.82,.65,1.39],i%2?'#a5a68d':'#a8a290',.07*j)
  for(const rock of ruinBoulders)p.rock(...rock)
  p.table(6,-44,2.2,.75)
  p.box([-.95,y+1.12,-44.22],[1.75,1.85,.18],'#8b9487')
  p.box([-.95,y+1.12,-44.06],[1.5,1.56,.16],'#c0af92')
  p.beam([5,y,-49],[5,y+11,-49],.25,'#86624a')
  p.beam([3.3,y+8.9,-49],[7.2,y+10.55,-49],.27,'#b86c3c')
  p.box([7,y+10.62,-49],[.64,.55,.56],'#d48e52')
  for(const [x,z] of [[10,-24],[28,-52],[115,-62]])p.marker(x,z)
  for(const [index,{x,z,lampY}] of scope.stations.entries()){
    const b=yAt(x,z)
    p.beam([x,b,z],[x,lampY-(index===0?.67:.32),z],.22,'#9d7957')
    if(index===0){
      for(const dx of [-1.13,1.13])p.box([x+dx,lampY,z],[.25,1.32,.21],'#dd8f3f',.50)
      for(const dy of [-.59,.59])p.box([x,lampY+dy,z],[2.45,.19,.22],'#dba050',.50)
    }else{
      p.box([x,lampY,z],[1.14,.66,.22],'#ecaf53',.50)
      p.box([x,lampY,z-.13],[.17,.51,.075],'#f5dc9f',.50)
    }
  }
  return p.finish()
}

function towerMesh(){
  const p=new Painter(79)
  const {x,z,base,top,front,stepStart}=tower
  for(const dx of [-2.05,2.05])for(const dz of [-3,3]){
    p.box([x+dx,base+.15,z+dz],[.86,.68,.83],'#a1a190')
    p.beam([x+dx,base,z+dz],[x+dx,top+3.45,z+dz],.28,'#785d42')
  }
  for(const dx of [-2.05,2.05]){
    p.beam([x+dx,base+.4,z-3],[x+dx,top,z+3],.18,'#a28155')
    p.beam([x+dx,base+.4,z+3],[x+dx,top,z-3],.18,'#a28155')
  }
  for(let i=0;i<19;i++)p.box([x,top-.085,-114.5+i*.6],[4.46,.16,.58],i%4?'#a98c61':'#ba9c70')
  for(let i=0;i<18;i++){
    const t=(i+1)/18,sz=stepStart+(front-stepStart)*t, sy=base+(top-base)*t
    p.box([x,sy-.12,sz],[3.08,.21,.46],i%3?'#a6885b':'#bea274')
    if(i%3===2)for(const sign of [-1,1])p.beam([x+sign*1.56,sy-.15,sz],[x+sign*1.56,sy+1.03,sz],.11,'#8d6e49')
  }
  for(const sign of [-1,1]){
    p.beam([x+sign*1.56,base+1,stepStart],[x+sign*1.56,top+1,front],.15,'#c4a570')
    p.beam([x+sign*2.12,top+1,-114.36],[x+sign*2.12,top+1,front],.14,'#c3a16e')
    for(let i=0;i<6;i++)p.beam([x+sign*2.1,top,-113.9+i*2],[x+sign*2.1,top+1,-113.9+i*2],.1,'#876a4e')
  }
  for(const side of [-1,1]){
    p.beam([x+side*1.28,base-.15,stepStart],[x+side*1.28,top-.28,front],.27,'#695b46')
    const midZ=stepStart+(front-stepStart)*.60
    p.beam([x+side*1.29,base-.2,midZ],[x+side*1.29,base+(top-base)*.60-.18,midZ],.22,'#75634b')
    p.beam([x+side*1.29,base+.19,midZ-1],[x+side*1.29,base+(top-base)*.60-.35,midZ],.11,'#867356')
  }
  p.beam([x-2.1,top+1,-114.36],[x+2.1,top+1,-114.36],.15,'#c3a16e')
  for(const side of [-1,1]){
    p.slab([x+side*2.86,top+3.18,-115.2],[x,top+4.8,-115.2],[x,top+4.8,-106.4],[x+side*2.86,top+3.18,-106.4],side>0?'#b97846':'#d39153')
    for(let i=1;i<5;i++)p.beam([x+side*i*.57,top+4.82-i*.323,-115.3],[x+side*i*.57,top+4.82-i*.323,-106.3],.071,'#ad714b')
  }
  p.beam([x,top+4.86,-115.3],[x,top+4.86,-106.3],.13,'#ecd09b')
  p.beam([x,top+4.8,-111],[x,top+7.35,-111],.093,'#615947')
  p.slab([x,top+7.2,-111],[x+1.7,top+7.17,-111],[x+1.32,top+6.52,-111],[x,top+6.5,-111],'#e4ab57')
  p.box([78,top+.43,-112],[.56,.85,.48],hinges)
  p.beam([77.72,top+1.27,-112.58],[78.48,top+.9,-111.14],.35,'#a9986f',true)
  p.beam([78.42,top+.94,-111.25],[78.57,top+.86,-110.96],.48,'#63766c',true)
  p.beam([78.55,top+.87,-110.99],[78.6,top+.84,-110.89],.35,'#8bb3a9',true)
  p.box([79.48,top+.86,-108],[.48,1,.96],'#63736b')
  for(const [mx,mz] of [[62,-91],[79,-93],[110,-132],[104,-156]])p.marker(mx,mz)
  return p.finish()
}

function coast(){
  const p=new Painter(92)
  for(const rock of coastBoulders())p.rock(...rock)
  for(const [x,z] of [[122,17],[144,24],[153,38],[183,-19],[110,65]])p.cairn(x,z)
  p.marker(121,18,1.6)
  p.box([121,yAt(121,18)+1.49,18],[1.03,.52,.108],'#b8b3a0',.34)
  return p.finish()
}
function chamber(){
  const p=new Painter(99)
  const {x,z,entryX,base}=archive
  const ceiling=base+4.45
  p.box([168,base-.11,z],[20.2,.24,9.5],'#69736b')
  p.box([168,ceiling,z],[21.3,.65,10.65],'#5b645e')
  p.box([178.06,base+2.12,z],[.77,4.7,10.24],'#6e7770')
  for(const sign of [-1,1]){
    p.box([168,base+2.13,z+sign*4.68],[21.4,4.58,1.01],'#788179')
    p.box([entryX,base+2.07,z+sign*3.65],[1.64,4.6,2.76],'#8c9587')
    p.box([entryX-.68,base+1.56,z+sign*2.28],[.32,3.17,.26],'#414d4b')
    for(let i=0;i<7;i++)p.box([159.5+i*2.85,base+2.14,z+sign*4.16],[.087,4.07,.034],'#6a776f')
  }
  p.box([entryX,base+3.98,z],[1.64,1.36,4.6],'#899387')
  p.box([entryX-.78,base+3.37,z],[.3,.26,4.55],hinges)
  p.box([entryX-.87,base+3.72,z],[.19,.29,2.55],'#b29e73')
  for(const [cx,cz] of [[159,33],[158.7,43],[165,34],[176,42],[167,37]]){
    p.beam([cx,base+.2,cz],[cx,ceiling-.35,cz],.11,'#ac8c57')
  }
  for(const cx of [162.4,167.4,173.3]){
    p.box([cx,ceiling-.31,38],[.12,.13,7.2],'#687269')
    p.box([cx,ceiling-.48,38],[1.35,.16,.31],'#e9c280')
  }
  p.table(174.25,39.9,3.25,1.52,base)
  p.box([174.09,base+1.093,40.22],[1.52,.021,.59],'#baaa81',.10)
  p.box([174.28,base+1.109,39.99],[1.23,.019,.49],'#d9cea1',-.09)
  for(let row=0;row<4;row++)p.box([174.29,base+1.122,39.83+row*.11],[1.01,.003,.006],'#807a63',-.09)
  p.table(172.5,35.5,4.75,1.72,base)
  for(let i=0;i<7;i++){
    p.box([172.6+i*.38,base+1.21,35.25],[.23,.3,.66],i%2?'#485e59':'#a08059')
    p.box([172.6+i*.38,base+1.22,34.91],[.14,.07,.04],'#c5b889')
  }
  for(const dx of [0,1.9,3.8])for(const dy of [.45,1.18,1.95])
    p.box([163.2+dx,base+dy,42],[1.53,.57,.89],dy>1?'#667368':'#816b51')
  p.box([177.53,base+2.57,39],[.13,1.55,2.75],'#4e645c')
  for(let i=0;i<4;i++)p.box([177.44,base+2.17+i*.25,39+(i%2)*.18],[.034,.024,1.82-i*.18],'#c4b78e')
  p.beam([174.8,base+1.11,39.84],[174.8,base+1.78,39.84],.068,'#747c65',true)
  p.shape(unitCone,[174.8,base+1.75,39.84],[.23,.22,.23],'#d9bd81')
  return p.finish()
}

function cabins(){
  const p=new Painter(725)
  const random=rng(4890)
  for(const {x,z,w,d,wall,roof,door} of fieldCabins){
    const ground=yAt(x,z)-.12, wallHeight=2.28, eave=ground+wallHeight, ridge=eave+1.24
    p.box([x,ground+.15,z],[w+.15,.49,d+.15],'#686d61')
    p.box([x,ground+1.28,z],[w,2.24,d],wall)
    for(let row=0;row<10;row++){
      const h=ground+.45+row*.195
      for(const side of [-1,1]){
        p.box([x,h,z+side*(d/2+.039)],[w+.12,.174,.078],wall)
        p.box([x+side*(w/2+.04),h,z],[.077,.17,d+.14],wall)
      }
    }
    for(const side of [-1,1]){
      const zEdge=z+side*(d*.5+.39)
      p.slab([x-w/2-.43,eave,zEdge],[x+w/2+.43,eave,zEdge],
        [x+w/2+.43,ridge,z],[x-w/2-.43,ridge,z],roof)
      for(let row=0;row<7;row++){
        const v=(row+.15)/7
        const hz=ridge-v*1.24+.021,zAt=z+side*v*(d*.5+.39)
        const length=w+1
        p.beam([x-length/2,hz,zAt],[x+length/2,hz,zAt],.036,roof)
        const columns=Math.ceil(length/.30)
        for(let i=0;i<columns;i++){
          const px=x-length*.5+(i+.3+row%2*.31)*length/columns
          if(px>x+length*.49)continue
          p.beam([px,hz,zAt],[px+.013,hz-.15,zAt+side*(d*.5+.39)*.13],.021,random()>.76?'#655a4c':roof)
        }
      }
    }
    p.beam([x-w/2-.55,ridge+.028,z],[x+w/2+.55,ridge+.028,z],.18,'#827e6a')
    for(const sx of [-1,1]){
      const px=x+sx*w*.5
      p.slab([px,eave,z-d*.5],[px,ridge,z],[px,eave,z+d*.5],[px,eave-.38,z],wall)
      for(let i=0;i<5;i++){
        const span=(d*.5)*(1-i/5)
        p.beam([px+sx*.04,eave+i*.23,z-span],[px+sx*.04,eave+i*.23,z+span],.117,wall)
      }
    }
    const front=z+d/2+.1
    p.box([x,ground+1.13,front],[.88,1.91,.135],door)
    for(const offset of [-.49,.49])p.box([x+offset,ground+1.13,front+.019],[.132,2.02,.128],'#554a3e')
    p.box([x,ground+2.075,front+.019],[1.106,.15,.12],'#62574a')
    p.box([x+.284,ground+1.08,front+.09],[.065,.068,.032],'#73624a')
    p.box([x,ground+.23,front+.25],[1.22,.275,.65],'#7f7866')
    if(w>5)for(const side of [-1,1]){
      const wx=x+side*w*.295
      p.box([wx,ground+1.45,front+.019],[1.12,.82,.12],'#3f4940')
      p.box([wx,ground+1.45,front+.09],[.78,.56,.055],'#56635e')
      p.box([wx,ground+1.45,front+.127],[.056,.59,.038],'#8b7d66')
      p.box([wx,ground+1.45,front+.127],[.78,.048,.038],'#8b7d66')
      p.box([wx+side*.58,ground+1.45,front+.043],[.29,.73,.064],door,side*.14)
    }
    if(w>6){
      p.box([x+w*.31,ground+2.84,z-.61],[.53,2.49,.67],'#776e60')
      p.box([x+w*.31,ground+4.10,z-.61],[.70,.18,.82],'#888071')
    }
  }
  return p.finish()
}
const builders=[beach,forest,camp,fallsRocks,ruins,towerMesh,coast,chamber,cabins]
const markerColors={note:'#e9d5a3',inspect:'#a5b792',part:'#c3a263',puzzle:'#9c865d',view:'#d2b383',secret:'#8fa590',relic:'#a0b18d',ending:'#e7c997'}
export function itemBase(item:Item){
  return yAt(item.x,item.z)+(item.lift??0)
}
function itemModel(item:Item){
  const p=new Painter(item.id.length*469)
  const {x,z,kind,id}=item
  const y=itemBase(item)
  const color=markerColors[kind]
  if(id==='wreck'||id==='sight'||id==='repair'||id==='bearing') return null
  if(id==='tide'){
    p.beam([x+1.6,y+1.55,z],[x+2.15,y+1.55,z],.48,'#546961',true)
    p.beam([x+1.52,y+.97,z],[x+1.52,y+2.13,z],.095,gold,true)
    p.beam([x+1.52,y+1.55,z-.6],[x+1.52,y+1.55,z+.6],.095,gold,true)
    return p.finish()
  }
  if(kind==='view'||kind==='secret'){
    p.cairn(x,z,kind==='view'?3:2)
    return p.finish()
  }
  if(kind==='note'||kind==='ending'){
    const onTable=['landing','dispatch','roster','final'].includes(id)
    const h=onTable?(id==='landing'?.91:1.09):id==='relief'?1.6:id==='tower-log'?1:.85
    if(!onTable&&id!=='relief'){
      p.beam([x,y,z],[x,y+h,z],.13,'#8b7353')
      p.box([x,y+h-.1,z],[.66,.18,.47],'#a6895c')
    }
    if(id==='relief'){
      for(let i=0;i<4;i++)p.box([x-.52+i*.32,y+h,z+.05],[.15,.18,.16],i%2?'#867b64':'#7a7866',.1*i)
    } else{
      p.box([x,y+h,z],[.69,.075,.56],id==='final'?'#b2986d':'#a57c4d',.14)
      p.box([x-.035,y+h+.042,z+.015],[.57,.042,.45],color,.14)
      for(let i=0;i<4;i++)p.box([x+.019*i,y+h+.067,z+.12-i*.063],[.34-i*.035,.006,.014],'#a38962',.14)
    }
  } else if(kind==='puzzle'){
    const h=id==='lockbox'?1.37:1.24
    p.box([x,y+h,z],[id==='lockbox'?1.02:1.25,.48,.74],id==='lockbox'?'#626f65':'#676e5e')
    p.box([x,y+h+.24,z],[id==='lockbox'?1.05:1.28,.09,.76],color)
    for(let i=0;i<3;i++)p.box([x-.25+i*.25,y+h,z+.382],[.12,.14,.043],i%2?'#b19c71':'#b9a77a')
  } else {
    const h=id==='lens'?1.18:id==='recorder'?1.28:id==='plate'?1.05:id==='compass'?.66:id==='lamp'?.78:.42
    if(h<1&&id!=='compass')p.rock([x,y+.07,z],[.51,.22,.42],'#90977a',.76)
    if(id==='lens'||id==='compass'||id==='lamp'){
      p.beam([x,y+h-.13,z],[x,y+h+.13,z],.21,id==='lamp'?'#edca7b':color,true)
      p.beam([x,y+h+.12,z],[x,y+h+.18,z],.17,id==='lens'?'#8cc5b6':'#ddbf83',true)
    }else if(id==='recorder'){
      p.box([x,y+h,z],[1.05,.38,.57],'#526859')
      p.beam([x-.39,y+h+.28,z],[x+.39,y+h+.28,z],.19,'#cfba8e',true)
    }else if(id==='bottle'||id==='float'){
      p.beam([x,y+h-.2,z],[x,y+h+.16,z],.14,id==='float'?'#b78251':'#628a69',true)
      p.beam([x,y+h+.14,z],[x,y+h+.26,z],.07,'#daae79',true)
    }else p.box([x,y+h,z],[.42,.14,.32],color,.28)
  }
  return p.finish()
}

const entranceX=archive.entryX
const doorGeo=(()=>{
  const p=new Painter(5551), x=entranceX, z=archive.z
  p.box([0,1.56,0],[.38,3.16,4.32],'#536861')
  for(const dz of [-1.9,-.61,.61,1.9])p.box([-.22,1.68,dz],[.09,2.86,.115],'#879788')
  for(const h of [.28,2.68])p.box([-.245,h,0],[.105,.14,4.18],'#a3a790')
  p.box([-.25,1.42,0],[.15,.31,.6],'#495951')
  p.box([-.36,1.42,0],[.046,.12,.37],gold)
  for(const v of [-1,1])p.box([-.24,.72,v*1.48],[.065,.18,.37],'#c1a56c',0,v*.17)
  return {x,z,geometry:p.finish()}
})()

export function Structures({progress,low=false}:{progress:Progress;low?:boolean}){
  const staticMeshes=useMemo(()=>builders.map(make=>make()),[])
  const canvas=useMemo(campCanvas,[])
  const props=useMemo(()=>items.map(item=>({item,geo:itemModel(item)})),[])
  const door=useRef<T.Mesh>(null)
  const unlocked=solved(progress,'tide')
  useFrame((_,dt)=>{
    if(door.current)door.current.position.y=T.MathUtils.damp(door.current.position.y,archive.base+(unlocked?3.38:0),9,dt)
  })
  return <>
    <group>{staticMeshes.map((geo,i)=><mesh key={i} geometry={geo} castShadow receiveShadow material={islandMaterial([3,4,6,7].includes(i)?'stone':'architecture',{vertexColors:true,side:T.DoubleSide,roughness:.94})}/>)}</group>
    <mesh geometry={canvas} material={islandMaterial('fabric',{vertexColors:true,roughness:.96,side:T.DoubleSide})} castShadow receiveShadow/>
    <Waterfall low={low}/>
    <group>{props.map(({item,geo})=>geo&&(objectAvailable(progress,item)||item.kind==='view'||item.kind==='secret'||item.id==='recorder')&&<mesh key={item.id} geometry={geo} castShadow receiveShadow material={islandMaterial('architecture',{vertexColors:true,side:T.DoubleSide,roughness:.77})}/>)}</group>
    <mesh ref={door} geometry={doorGeo.geometry} position={[doorGeo.x,archive.base,doorGeo.z]} castShadow receiveShadow material={islandMaterial('architecture',{vertexColors:true,roughness:.82,metalness:.19})}/>
    {solved(progress,'relay')&&[[5,22+10.6,-49],[scope.stations[0].x,scope.stations[0].lampY+.60,scope.stations[0].z],...scope.stations.slice(1).map(({x,z,lampY})=>[x,lampY,z])].map(([x,y,z])=>
      <mesh key={x} position={[x,y,z-.16]}><sphereGeometry args={[.18,7,5]}/><meshBasicMaterial color="#ffe49d"/></mesh>)}
    {has(progress,'final')&&<pointLight position={[174,9,39]} color="#fbd593" intensity={24} distance={10}/>}
    <pointLight position={[174.9,9.12,39]} color="#ffdfac" intensity={47} distance={14}/>
    <pointLight position={[163.5,10.9,38]} color="#ffd28e" intensity={49} distance={17}/>
    <pointLight position={[171.3,10.75,38.7]} color="#f4d79e" intensity={34} distance={13}/>
    <TrailSigns/>
  </>
}
function TrailSigns(){
  const geo=useMemo(()=>{
    const p=new Painter(123)
    for(const path of paths)for(let i=1;i<path.length-1;i+=2){
      const [x,z]=path[i]
      if(x>148&&z>28)continue
      const dx=Math.cos(i*6.4)*2.9,dz=Math.sin(i*6.4)*2.9
      p.cairn(x+dx,z+dz,2)
    }
    return p.finish()
  },[])
  return <mesh geometry={geo}><meshStandardMaterial vertexColors roughness={.96}/></mesh>
}
