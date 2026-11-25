import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { rng } from './world-data.ts'
import { treeProfile, type TreeSpecies } from './vegetation-layout.ts'

type V=[number,number,number]
class GeometryBrush {
  private positions:number[]=[]
  private colors:number[]=[]
  private uv:number[]=[]
  private parts:T.BufferGeometry[]=[]
  triangle(a:V,b:V,c:V,color:T.Color,uvs=[0,0,1,.5,0,1]){
    this.positions.push(...a,...b,...c)
    for(let i=0;i<3;i++)this.colors.push(color.r,color.g,color.b)
    this.uv.push(...uvs)
  }
  quad(a:V,b:V,c:V,d:V,color:T.Color){
    this.triangle(a,b,c,color,[0,.5,.53,0,1,.5])
    this.triangle(a,c,d,color,[0,.5,1,.5,.53,1])
  }
  branch(a:V,b:V,base:number,tip:number,color:T.Color,detail=7){
    const start=new T.Vector3(...a),end=new T.Vector3(...b),dir=end.clone().sub(start)
    const original=new T.CylinderGeometry(tip,base,dir.length()*1.04,detail)
    const g=original.toNonIndexed()
    original.dispose()
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize()))
    g.translate(...start.lerp(end,.5).toArray())
    const cs=new Float32Array(g.attributes.position.count*3)
    for(let i=0;i<cs.length;i+=3)cs.set([color.r,color.g,color.b],i)
    g.setAttribute('color',new T.BufferAttribute(cs,3));this.parts.push(g)
  }
  tube(points:V[],radii:number[],color:T.Color,radial:number,phase:number){
    // A continuous taper avoids the seams and hard silhouettes of stacked cylinders.
    const segments=points.length-1
    const p:number[]=[],n:number[]=[],uv:number[]=[],colors:number[]=[],indices:number[]=[]
    for(let i=0;i<=segments;i++){
      const center=new T.Vector3(...points[i])
      const axis=new T.Vector3(...points[Math.min(segments,i+1)]).sub(new T.Vector3(...points[Math.max(0,i-1)])).normalize()
      const xAxis=new T.Vector3(0,0,1).cross(axis).normalize()
      const zAxis=new T.Vector3().crossVectors(axis,xAxis).normalize()
      for(let j=0;j<=radial;j++){
        const angle=j/radial*Math.PI*2
        const irreg=1+.10*Math.cos(angle*3+phase+i*.23)+.07*Math.sin(angle*5+phase)
        const outward=xAxis.clone().multiplyScalar(Math.cos(angle)).addScaledVector(zAxis,Math.sin(angle))
        const surface=center.clone().addScaledVector(outward,radii[i]*irreg)
        p.push(surface.x,surface.y,surface.z);n.push(outward.x,outward.y,outward.z)
        uv.push(j/radial,i/segments)
        const shade=.87+.13*irreg
        colors.push(color.r*shade,color.g*shade,color.b*shade)
        if(i<segments&&j<radial){
          const index=i*(radial+1)+j,next=index+radial+1
          indices.push(index,index+1,next,index+1,next+1,next)
        }
      }
    }
    const shape=new T.BufferGeometry()
    shape.setAttribute('position',new T.Float32BufferAttribute(p,3))
    shape.setAttribute('normal',new T.Float32BufferAttribute(n,3))
    shape.setAttribute('uv',new T.Float32BufferAttribute(uv,2))
    shape.setAttribute('color',new T.Float32BufferAttribute(colors,3))
    shape.setIndex(indices)
    this.parts.push(shape.toNonIndexed())
    shape.dispose()
  }
  make(){
    if(this.positions.length){
      const geometry=new T.BufferGeometry()
      geometry.setAttribute('position',new T.Float32BufferAttribute(this.positions,3))
      geometry.setAttribute('color',new T.Float32BufferAttribute(this.colors,3))
      geometry.setAttribute('uv',new T.Float32BufferAttribute(this.uv,2))
      geometry.computeVertexNormals()
      this.parts.push(geometry)
    }
    const merged=mergeGeometries(this.parts)
    this.parts.forEach(g=>g.dispose())
    return merged
  }
}

const leafPalette=new T.Color('#496a39')
const lightLeaf=new T.Color('#7e8f52')
const oldLeaf=new T.Color('#5f6339')
const stalk=new T.Color('#82774f')
const palette=(random:()=>number)=>leafPalette.clone().lerp(lightLeaf,random()*.75).lerp(oldLeaf,random()*.26)
export function palmGeometry(seed:number,detailed:boolean){
  const bark=new GeometryBrush(),leaves=new GeometryBrush(),random=rng(seed)
  const tall=6.3+random()*1.6, lean=.7+random()*.61, curl=(random()-.5)*1.1
  const spine=(t:number):V=>[lean*t*t,tall*t,curl*t*t*t]
  const heights=detailed?22:10
  for(let i=0;i<heights;i++){
    const t=i/heights, b=spine(t), e=spine((i+1)/heights)
    const radius=(.30-.218*t)+Math.exp(-t*19)*.1
    const shade=new T.Color('#73715a').lerp(new T.Color('#ab9675'),random()*.43)
    bark.branch(b,e,radius*(1+random()*.06),radius*.96,shade,detailed?11:7)
    if(detailed&&i>0&&i%2===0){
      const p=spine(Math.min(1,t+.016))
      bark.branch(b,p,radius*1.07,radius*.99,shade.clone().multiplyScalar(.76),11)
    }
  }
  const crown=spine(1)
  for(let i=0;i<(detailed?15:10);i++){
    const a=i*2.399+random()*.35, length=2.6+random()*2.02, height=.71+random()*1.18
    const droop=1.03+random()*1.08+(i>8?.55:0), c=palette(random)
    const dir=[Math.cos(a),Math.sin(a)]
    const vec=(t:number,side:number,down:number):V=>[
      crown[0]+dir[0]*length*t-dir[1]*side,crown[1]+height*Math.sin(t*2.25)-droop*t*t+down,
      crown[2]+dir[1]*length*t+dir[0]*side
    ]
    const n=detailed?20:8
    for(let j=0;j<n;j++){
      const t=j/n,next=(j+1)/n
      const width=.019*Math.sin(Math.PI*(t+.04))
      leaves.quad(vec(t,-width,0),vec(t,width,0),vec(next,width,0),vec(next,-width,0),stalk)
      if(j===0)continue
      for(const side of [-1,1]){
        const span=(.18+.68*Math.sin(Math.PI*t)**.72)*(1-t*.39)*(1+random()*.26)
        const end=Math.min(1.02,t+.13+random()*.078),w=(detailed?.068:.105)*(1-t*.52)
        leaves.quad(vec(Math.max(0,t-w),0,0),vec(end-.085,side*span*.63,-span*.16),
          vec(end,side*span,-span*.30-.065),vec(end-.021,side*span*.55,-span*.22),
          c.clone().multiplyScalar(.87+random()*.27))
      }
    }
  }
  return {wood:bark.make(),leaf:leaves.make()}
}

const crownTraits={
  laurel:{height:8.6,spread:3.1,lean:.64,boughs:11,bark:'#766b53',texture:0,scale:1.09},
  dracaena:{height:6.45,spread:3.08,lean:1.12,boughs:10,bark:'#807868',texture:1,scale:1.14},
  fig:{height:10.6,spread:4.45,lean:1.06,boughs:13,bark:'#777568',texture:2,scale:1.31},
  pine:{height:11.1,spread:3.20,lean:.73,boughs:17,bark:'#785e48',texture:3,scale:1.11},
} as const

export function islandTree(species:TreeSpecies,seed:number,detailed:boolean){
  const bark=new GeometryBrush(),leaves=new GeometryBrush(),random=rng(seed)
  const traits=crownTraits[species]
  const height=traits.height*(.90+random()*.21),spread=traits.spread*(.83+random()*.32)
  const woodColor=new T.Color(traits.bark),radius=treeProfile[species].radius
  const angle=random()*Math.PI*2,phase=random()*5
  const main=(t:number):V=>[
    Math.cos(angle)*traits.lean*t*t+Math.sin(t*5.8+phase)*.20*t,
    height*t-.18,
    Math.sin(angle)*traits.lean*t*t+Math.cos(t*6.1+phase)*.23*t,
  ]
  const sections=detailed?10:5
  const samples=Array.from({length:sections+1},(_,i)=>i/sections)
  bark.tube(samples.map(main),samples.map(t=>radius*(.13+.87*(1-t)**1.14)),woodColor,detailed?12:8,phase)
  for(let j=0;j<(species==='fig'?8:5);j++){
    const direction=j*2.399+random()*.47,wide=species==='fig'?1.32:1.01
    const root=radius*(1.25+random()*.95)*wide
    const ux=Math.cos(direction),uz=Math.sin(direction)
    const a:V=[ux*root,-.13,uz*root],mid:V=[ux*root*.5,.13,uz*root*.5]
    const h=radius*(species==='fig'?1.8:1.06)+random()*.3
    bark.tube([a,mid,[0,h,0]],[.05,.16*wide,.25*wide],woodColor,detailed?7:5,phase)
    if(species==='fig'){
      // Stagger the planes of the exposed buttress roots around the flare.
      const shaded=woodColor.clone().multiplyScalar(.81+random()*.18)
      bark.triangle(a,[mid[0]*.38,h*.93,mid[2]*.38],[mid[0]+uz*.23,.03,mid[2]-ux*.23],shaded)
      bark.triangle(a,[mid[0]-uz*.21,.035,mid[2]+ux*.21],[mid[0]*.38,h*.93,mid[2]*.38],woodColor)
    }
  }
  const tileX=traits.texture%2*.5,tileY=Math.floor(traits.texture/2)*.5
  const uv=(u:number,v:number)=>[tileX+.009+u*.482,tileY+.009+v*.482]
  function cluster(at:V,width:number,steps:number,shade:number){
    for(let j=0;j<steps;j++){
      const bearing=j*2.399+random()*1.1
      const tilt=j%3===1?.53+random()*.16:(random()-.5)*.52
      const ux=Math.cos(bearing),uz=Math.sin(bearing)
      const offset=(j===0?0:.25+random()*.6)*width
      const center:V=[at[0]+ux*offset,at[1]+(random()-.48)*width*.65,at[2]+uz*offset]
      const w=width*(.64+random()*.38),h=width*(.64+random()*.40)
      const point=(s:number,t:number):V=>[
        center[0]+ux*s*w-uz*t*h*Math.cos(tilt),
        center[1]+t*h*Math.sin(tilt)+(1-s*s)*h*.19,
        center[2]+uz*s*w+ux*t*h*Math.cos(tilt),
      ]
      const c=new T.Color().setRGB(shade,shade*(.92+random()*.16),shade*(.87+random()*.18))
      for(const [s0,s1] of [[-1,0],[0,1]]){
        const a=point(s0,-1),b=point(s1,-1),d=point(s0,1),e=point(s1,1)
        const qa=uv((s0+1)*.5,0),qb=uv((s1+1)*.5,0),qd=uv((s0+1)*.5,1),qe=uv((s1+1)*.5,1)
        leaves.triangle(a,d,b,c,[...qa,...qd,...qb])
        leaves.triangle(b,d,e,c,[...qb,...qd,...qe])
      }
    }
  }
  for(let i=0;i<traits.boughs;i++){
    const bearing=angle+i*2.399+random()*.46
    const ux=Math.cos(bearing),uz=Math.sin(bearing)
    const level=i/(traits.boughs-1),pine=species==='pine',dragon=species==='dracaena'
    const reach=spread*(.64+random()*.38)*(pine?1-.61*level:dragon?.95+.13*level:1-.30*level*level)
    const base=main(pine?.40+.49*level:dragon?.30+.26*level:.42+.34*level)
    const h=height*(pine?.54+.45*level:dragon?.76+random()*.16:.73+.24*level)
    const elbow:V=[base[0]+ux*reach*.55,base[1]+(h-base[1])*.66,base[2]+uz*reach*.51]
    const shoulder:V=[base[0]+ux*reach*.88,h-.35,base[2]+uz*reach*.81]
    const tip:V=[base[0]+ux*reach,h,base[2]+uz*reach]
    const r=radius*(dragon?.46:pine?.27:.35)*(1-.34*level)
    bark.tube([base,elbow,shoulder,tip],[r,r*.62,r*.29,r*.086],woodColor,detailed?8:5,phase+i)
    cluster(tip,traits.scale*(pine?1-.43*level:1),detailed?7:3,.84+random()*.38)
    if(dragon){
      if(detailed||i%2===0)cluster([tip[0],tip[1]+.24,tip[2]],traits.scale*.78,detailed?4:2,.92)
      continue
    }
    for(const side of [-1,1]){
      const offset=reach*(.13+random()*.14)*side
      const spur:V=[shoulder[0]-uz*offset,h+.35+random()*.53,shoulder[2]+ux*offset]
      if(detailed)bark.branch(elbow,spur,r*.24,r*.056,woodColor,5)
      cluster(spur,traits.scale*(pine?.69: .79),detailed?4:2,.79+random()*.32)
    }
  }
  if(species!=='dracaena')cluster(main(.99),traits.scale,detailed?9:4,1.07)
  return {wood:bark.make(),leaf:leaves.make()}
}

export function understory(type:'grass'|'fern'|'shrub',seed:number,detailed:boolean){
  const leaves=new GeometryBrush(),random=rng(seed)
  for(let i=0;i<(type==='grass'?8:type==='fern'?9:13);i++){
    const a=i*2.399+.5*random(),dx=Math.cos(a),dz=Math.sin(a)
    const width=type==='grass'?.024+random()*.039:type==='shrub'?.18+random()*.12:.19+random()*.15
    const length=(type==='grass'?.32:type==='fern'?.72:.47)+random()*.56
    const rise=(type==='grass'?.35:.53)+random()*.61
    const c=palette(random).multiplyScalar(type==='grass'?1.13:1.06)
    const root=(t:number,w:number):V=>[dx*t*length-dz*w,rise*Math.sin(t*1.9)-t*t*.18,dz*t*length+dx*w]
    if(type==='fern'){
      const steps=detailed?14:7
      for(let j=1;j<steps;j++){
        const t=j/steps
        const w=width*Math.sin(Math.PI*t)**.52*(1-t*.28)
        for(const sign of [-1,1]){
          leaves.quad(root(t-.036,0),root(t+.035,sign*w*.61),root(t+.12,sign*w),root(t+.065,sign*w*.2),c.clone().multiplyScalar(.85+random()*.27))
        }
      }
    }else if(type==='shrub'){
      const leaf=(t:number,lateral:number):V=>{
        const w=width*Math.sin(Math.PI*t)**.75*lateral
        const value=root(t,w)
        value[1]-=.075*lateral*lateral*Math.sin(t*Math.PI)
        return value
      }
      const segments=detailed?7:3
      for(let segment=0;segment<segments;segment++){
        const a=segment/segments,b=(segment+1)/segments
        for(const side of [-1,1]){
          const u=side===1?1:0
          const tone=c.clone().multiplyScalar(side===1?.88:1)
          leaves.triangle(leaf(a,0),leaf(a,side),leaf(b,side),tone,[a,.5,a,u,b,u])
          leaves.triangle(leaf(a,0),leaf(b,side),leaf(b,0),tone,[a,.5,b,u,b,.5])
        }
      }
    }else{
      leaves.quad(root(0,0),root(.43,width),root(1,0),root(.43,-width),c)
    }
  }
  return leaves.make()
}

export function shorelineRock(seed:number,detail:number){
  const random=rng(seed)
  const phase=random()*7,form=new T.IcosahedronGeometry(1,detail)
  const pos=form.attributes.position
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i)
    const irregular=1+Math.sin(x*6.1+phase)*Math.cos(z*4.8+y*5.2)*.19+Math.sin(x*13.+z*11.)*.042
    pos.setXYZ(i,x*irregular+Math.sin(y*5.+phase)*.17,y*irregular*.89+Math.sin(z*4.+phase)*.105,z*irregular)
  }
  const smoothNormals=Float32Array.from(form.attributes.normal.array)
  form.computeVertexNormals()
  const normal=form.attributes.normal
  const n=new T.Vector3()
  for(let i=0;i<normal.count;i++){
    const k=i*3
    n.set(normal.getX(i)*.55+smoothNormals[k]*.45,normal.getY(i)*.55+smoothNormals[k+1]*.45,normal.getZ(i)*.55+smoothNormals[k+2]*.45).normalize()
    normal.setXYZ(i,n.x,n.y,n.z)
  }
  return form
}
