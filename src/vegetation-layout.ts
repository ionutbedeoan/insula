import { biomeAt } from './biomes.ts'
import { items } from './content.ts'
import { fieldCabins, shorePalms, sightCorridor } from './landmarks.ts'
import { distance, height, placeIds, places, rng, shore, trailDistance } from './world-data.ts'

export const variants=['palm','tree','fern','grass','rock'] as const
export type Kind=typeof variants[number]
export type Plant = {x:number;y:number;z:number;s:number;turn:number;tint:number;squash:number;type:Kind}
function scatter(){
  const random=rng(955319)
  const plants:Record<Kind,Plant[]>={palm:[],tree:[],fern:[],grass:[],rock:[]}
  for(const [x,z,s,turn] of shorePalms)plants.palm.push({x,y:height(x,z)-.07,z,s,turn,tint:.92,squash:1,type:'palm'})
  const targets=[602,216,1970,8200,545]
  const verge:[number,number,number][]=[
    [5,178,10],[10,183,8],[38,175,10],[44,185,9],[2,187,7],[30,167,10],
    [-27,147,13],[-10,150,12],[-31,129,14],[-13,128,13],[-36,107,14],[-51,107,14],
    [-52,72,14],[-92,75,12],[-82,77,13],[-115,-46,12],[-101,-51,13],[-121,-60,10],
    [-95,-42,10],[123,-2,12],[158,-26,15]
  ]
  for(const [x0,z0,width] of verge)for(let i=0;i<58;i++){
    const x=x0+(random()-.5)*width,z=z0+(random()-.5)*width
    const type=i%7===0?'fern':'grass'
    if(shore(x,z)<11||trailDistance(x,z)<1.85)continue
    if(fieldCabins.some(c=>Math.abs(x-c.x)<c.w/2+1&&Math.abs(z-c.z)<c.d/2+1))continue
    if(items.some(item=>Math.hypot(item.x-x,item.z-z)<1.3))continue
    plants[type].push({x,y:height(x,z)-.04,z,s:.29+random()*.50,turn:random()*6.283,tint:.67+random()*.43,squash:1,type})
  }
  for(const [index,type] of variants.entries()){
    const output=plants[type], woody=index<2, grass=type==='grass'
    for(let i=0;i<targets[index]*32&&output.length<targets[index];i++){
      // Alternate broad coverage with the forest and west drainage catchment.
      let x=(random()-.5)*504,z=(random()-.5)*489
      if(i%4===0){x=-26+(random()-.5)*175;z=96+(random()-.5)*174}
      else if(i%7===0){x=-104+(random()-.5)*126;z=-55+(random()-.5)*167}
      const y=height(x,z),edge=shore(x,z)
      const biome=biomeAt(x,z)
      if(y<1.15||edge<(woody?12:4.9))continue
      const track=trailDistance(x,z)
      if(track<(woody?4.6:grass?1.25:2.7))continue
      if(woody&&(Math.abs(x-19)<12&&z>175&&z<208))continue
      if(fieldCabins.some(cabin=>Math.abs(x-cabin.x)<cabin.w*.5+(woody?4:1.45)&&Math.abs(z-cabin.z)<cabin.d*.5+(woody?4:1.45)))continue
      if(woody&&z>sightCorridor[0][1]&&z<sightCorridor[1][1]){
        const xAtZ=78+(z+112)*67/123
        if(Math.abs(x-xAtZ)<3.3)continue
      }
      const treeCluster=Math.sin(x*.058+z*.028)+Math.sin(z*.092-x*.014)
      if(woody&&treeCluster+random()*1.95<-.29)continue
      if(type==='tree'&&(y<8||edge<27||biome.lava>.64))continue
      if(grass&&edge<18&&random()<.72)continue
      if(type==='fern'&&(edge<9||y<4.3&&random()<.85))continue
      if(placeIds.some(id=>distance(x,z,places[id].point)<(woody ? (id==='archive'?21:id==='ruins'?22:id==='tower'?11:places[id].radius*.57) : (id==='archive'?18:id==='falls'?12:id==='camp'?8:4))))continue
      if(items.some(item=>distance(x,z,[item.x,item.z])<(woody?4.8:type==='rock'?2.35:1.17)))continue
      if(woody&&[...plants.palm,...plants.tree].some(plant=>Math.hypot(plant.x-x,plant.z-z)<(type==='tree'?4.1:2.43)))continue
      const size=type==='rock'?.24+random()**2.12*2.22:woody?(.65+random()*.77)*(1+biome.wet*.21):.32+random()*(.68+biome.wet*.54)
      output.push({x,y:y-(type==='rock'?size*.24:.06),z,s:size,turn:random()*Math.PI*2,tint:.60+random()*.46,squash:.64+random()*.65,type})
    }
  }
  return plants
}
export const plants=scatter()
export const vegetationCounts=Object.fromEntries(variants.map(kind=>[kind,plants[kind].length]))

export const treeProfile={
  laurel:{radius:.44},
  dracaena:{radius:.5},
  fig:{radius:.66},
  pine:{radius:.37},
} as const
export type TreeSpecies=keyof typeof treeProfile

export function treeSpecies({x,z,y}:Plant):TreeSpecies{
  const biome=biomeAt(x,z)
  const mix=.5+.5*Math.sin(x*.11-z*.078+Math.sin(z*.16))
  if(biome.wet>.49&&mix>.31)return 'fig'
  if((y>27&&mix>.52)||(biome.lava>.37&&y>18))return 'pine'
  if((y<16||biome.lava>.22)&&mix>.45)return 'dracaena'
  return 'laurel'
}
