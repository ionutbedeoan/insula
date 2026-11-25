import { useLayoutEffect, useMemo, useRef } from 'react'
import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { openingScans } from './assets/opening-scans.ts'
import { beachBoulders, forestLogs } from './solid-landmarks.ts'
import { archiveCapstones, groundPlots, notchRocks, openingStumps, scanBeachRocks, scanForestLogs, surfRocks } from './opening-layout.ts'
import { height, rng, trailDistance } from './world-data.ts'

const raw=(value:string)=>Uint8Array.from(atob(value),c=>c.charCodeAt(0)).buffer
function loadTexture(source:string,colorSpace:T.ColorSpace){
  const texture=new T.Texture()
  texture.flipY=false;texture.colorSpace=colorSpace;texture.anisotropy=4
  if(typeof Image!=='undefined'){
    const image=new Image()
    image.onload=()=>{texture.image=image;texture.needsUpdate=true}
    image.src=source
  }
  return texture
}
type Scan=keyof typeof openingScans
function scanAsset(kind:Scan){
  const source=openingScans[kind]
  const shape=new T.BufferGeometry()
  shape.setAttribute('position',new T.BufferAttribute(new Float32Array(raw(source.p)),3))
  shape.setAttribute('normal',new T.BufferAttribute(new Float32Array(raw(source.n)),3))
  shape.setAttribute('uv',new T.BufferAttribute(new Float32Array(raw(source.u)),2))
  shape.setIndex(new T.BufferAttribute(new Uint16Array(raw(source.i)),1))
  shape.computeBoundingSphere()
  const material=new T.MeshStandardMaterial({
    color:kind==='rock'?'#a6a9a0':'#d8c7aa',roughness:.90,
    map:loadTexture(source.diffuse,T.SRGBColorSpace),
    normalMap:loadTexture(source.normal,T.NoColorSpace),
    normalScale:new T.Vector2(.83,.83),
  })
  material.name='opening-'+kind
  return {shape,material}
}
export type Placement={x:number;y:number;z:number;w:number;h:number;d:number;yaw:number;tilt?:number}
const assets={stump:scanAsset('stump'),rock:scanAsset('rock'),log:scanAsset('log')}
const rocks:Placement[]=[
  ...scanBeachRocks.map(index=>{
    const [[x,y,z],[rx,ry,rz],,yaw]=beachBoulders[index]
    return {x,y:y-ry*.12,z,w:rx*1.77,h:ry*1.5,d:rz*1.78,yaw}
  }),
  ...surfRocks.map(({x,z,r,h,yaw})=>({x,z,y:height(x,z)+h*.20,w:r*2,h,d:r*1.47,yaw})),
  ...notchRocks.map(({x,z,w,h,d,yaw})=>({x,z,y:height(x,z)+h*.42,w,h,d,yaw})),
]
const stumps:Placement[]=openingStumps.map(p=>({...p,y:height(p.x,p.z)+p.h*.12}))
const logs:Placement[]=scanForestLogs.map(index=>{
  const [ax,az,bx,bz]=forestLogs[index]
  const x=(ax+bx)/2,z=(az+bz)/2,distance=Math.hypot(bx-ax,bz-az)
  const from=height(ax,az),to=height(bx,bz)
  return {x,y:(from+to)/2+.35,z,w:distance*1.02,h:1.17,d:1.02,yaw:Math.atan2(az-bz,bx-ax),tilt:Math.atan2(to-from,distance)}
})

function ScanBatch({kind,placements,low}:{kind:Scan;placements:Placement[];low:boolean}){
  const mesh=useRef<T.InstancedMesh>(null)
  const {shape,material}=assets[kind]
  useLayoutEffect(()=>{
    const output=mesh.current
    if(!output)return
    const transform=new T.Object3D()
    placements.forEach(({x,y,z,w,h,d,yaw,tilt=0},index)=>{
      transform.position.set(x,y,z)
      transform.rotation.set(0,yaw,tilt,'YXZ')
      transform.scale.set(w,h,d);transform.updateMatrix()
      output.setMatrixAt(index,transform.matrix)
    })
    output.instanceMatrix.needsUpdate=true
    output.computeBoundingSphere()
  },[placements])
  return <instancedMesh ref={mesh} args={[shape,material,placements.length]} castShadow={!low} receiveShadow dispose={null}/>
}

function litterGeometry(){
  const positions:number[]=[],colors:number[]=[]
  const random=rng(88779)
  const colorsByPlot={wrack:['#8b7252','#a18961','#b7a37b','#89806a'],litter:['#4d5041','#88744c','#656643','#9a7250'],mud:['#5b5244','#89745b','#51483a','#70624c']}
  const leaf=(x:number,z:number,y:number,w:number,length:number,turn:number,color:T.Color)=>{
    const point=(lat:number,lon:number,up:number)=>[x+Math.cos(turn)*lat*w+Math.sin(turn)*lon*length,y+up,z-Math.sin(turn)*lat*w+Math.cos(turn)*lon*length]
    const origin=point(0,-.43,0),tip=point(0,.57,.018),rib=point(0,.05,.029)
    for(const side of [-1,1]){
      const edge=point(side*.52,-.08,.008)
      const end=point(side*.32,.27,.016)
      positions.push(...origin,...edge,...rib,...edge,...end,...rib,...end,...tip,...rib)
      const dark=color.clone().multiplyScalar(side===1?.83:1)
      for(let i=0;i<9;i++)colors.push(dark.r,dark.g,dark.b)
    }
  }
  for(const plot of groundPlots){
    for(let i=0;i<224;i++){
      const bearing=random()*Math.PI*2, r=Math.sqrt(random())
      const x=plot.x+Math.cos(bearing)*r*plot.rx,z=plot.z+Math.sin(bearing)*r*plot.rz
      const edge=trailDistance(x,z)
      const cluster=Math.sin(x*1.3+z*.65)+Math.cos(x*.43-z*1.6)
      if((edge<1.15&&random()<.71)||cluster<-.42&&random()<.75)continue
      const palette=colorsByPlot[plot.kind]
      const color=new T.Color(palette[Math.floor(random()*palette.length)])
      const length=.08+random()**1.6*.28, w=length*(.21+random()*.57)
      leaf(x,z,height(x,z)+.035,w,length,random()*Math.PI*2,color)
    }
  }
  const result=new T.BufferGeometry()
  result.setAttribute('position',new T.Float32BufferAttribute(positions,3))
  result.setAttribute('color',new T.Float32BufferAttribute(colors,3))
  result.computeVertexNormals()
  return result
}
function softTexture(){
  const size=48,pixels=new Uint8Array(size*size*4)
  for(let row=0;row<size;row++)for(let col=0;col<size;col++){
    const i=(row*size+col)*4
    const radius=Math.hypot((col+.5)/size*2-1,(row+.5)/size*2-1)
    pixels.set([255,255,255,Math.round(255*Math.max(0,1-radius)**1.45)],i)
  }
  const texture=new T.DataTexture(pixels,size,size)
  texture.needsUpdate=true
  texture.magFilter=T.LinearFilter
  return texture
}
function shadowGeometry(){
  const plots=[...stumps,...logs,...rocks,{x:17,z:190,w:3.9,d:8.0,yaw:0},{x:26,z:182,w:2.1,d:2.0,yaw:0},
    {x:33,z:188,w:2.6,d:2.3,yaw:0},{x:-78,z:61,w:12,d:8.5,yaw:0},{x:-88,z:67,w:10.8,d:6.9,yaw:0}]
  const patches=plots.map(p=>{
    const patch=new T.PlaneGeometry(p.w*1.33,p.d*1.41,6,6).rotateX(-Math.PI/2).rotateY(p.yaw)
    const a=patch.attributes.position
    for(let i=0;i<a.count;i++){
      const x=p.x+a.getX(i),z=p.z+a.getZ(i)
      a.setXYZ(i,x,height(x,z)+.038,z)
    }
    return patch
  })
  const result=mergeGeometries(patches)
  patches.forEach(patch=>patch.dispose())
  return result
}
const leafMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:.98,side:T.DoubleSide})
const contactMaterial=new T.MeshBasicMaterial({
  color:'#30291d',map:softTexture(),opacity:.61,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,
})
export function OpeningScenery({low}:{low:boolean}){
  const debris=useMemo(()=>litterGeometry(),[])
  const occlusion=useMemo(()=>shadowGeometry(),[])
  return <group name="opening-scenery">
    <ScanBatch kind="rock" placements={rocks} low={low}/>
    <ScanBatch kind="rock" placements={archiveCapstones} low={low}/>
    <ScanBatch kind="stump" placements={stumps} low={low}/>
    <ScanBatch kind="log" placements={logs} low={low}/>
    <mesh name="ground-litter" geometry={debris} material={leafMaterial} receiveShadow/>
    <mesh name="opening-contact" geometry={occlusion} material={contactMaterial}/>
  </group>
}
