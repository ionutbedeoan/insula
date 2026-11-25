import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createElement as h } from 'react'
import { create } from '@react-three/test-renderer'
import * as T from 'three'
import { Terrain } from '../src/landscape.tsx'
import { ForestFerns } from '../src/fern-scan.tsx'
import { OpeningScenery } from '../src/opening-scenery.tsx'
import { openingScans } from '../src/assets/opening-scans.ts'
import { Habitats } from '../src/habitats.tsx'
import { LivingWorld } from '../src/living-world.tsx'
import { Structures } from '../src/structures.tsx'
import { Vegetation } from '../src/vegetation.tsx'
import { ExpeditionCharacters } from '../src/character.tsx'
import { emptyProgress } from '../src/progress.ts'
import { makeRuntime } from '../src/runtime.ts'
import { canopyPixels } from '../src/assets/canopy.ts'
import { aimScope } from '../src/scope-optics.ts'
import { floor, height, scope } from '../src/world-data.ts'

Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true,self:{requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{}}})
const runtime={current:makeRuntime()}
const progress={...emptyProgress(),solved:['lockbox','relay','repair','sight','bearing','tide']}
const lookFrom=(process.env.ISLAND_REVIEW_CAMERA??'0,0,5').split(',').map(Number)
const renderer=await create(h('group',null,h(Terrain),h(Structures,{progress}),h(Vegetation,{low:false,quality:'medium'}),
  h(ExpeditionCharacters,{runtime,menu:false,third:true}),h(Habitats,{low:false}),h(ForestFerns,{low:false}),h(OpeningScenery,{low:false}),h(LivingWorld,{low:false})),{camera:{position:lookFrom}})
runtime.current.cameraDistance=4
await renderer.advanceFrames(100,1/60)
const root=renderer.scene.instance
root.updateMatrixWorld(true)
const meshes=[],objects=[],lookup=new Map()
const flat=values=>Buffer.from(values.buffer,values.byteOffset,values.byteLength).toString('base64')
const color=material=>material.color?material.color.toArray():[1,1,1]
const mx=new T.Matrix4(), world=new T.Matrix4(), rgb=new T.Color()
function walk(node){
  if(!node.visible)return
  if(node.isMesh && !node.material.transparent){
    const geometry=node.geometry
    let mesh=lookup.get(geometry)
    if(mesh===undefined){
      mesh=meshes.length
      lookup.set(geometry,mesh)
      meshes.push({
        v:flat(geometry.attributes.position.array),
        i:geometry.index?flat(Uint32Array.from(geometry.index.array)):null,
        c:geometry.attributes.color?flat(geometry.attributes.color.array):null,
        w:geometry.attributes.surfaceWeights?flat(geometry.attributes.surfaceWeights.array):null,
        u:(['fern-scan','canopy'].includes(node.material.name)||node.material.name.startsWith('opening-'))?flat(geometry.attributes.uv.array):null
      })
    }
    if(node.isInstancedMesh){
      for(let i=0;i<node.count;i++){
        node.getMatrixAt(i,mx)
        if(node.instanceColor)node.getColorAt(i,rgb);else if(node.material.color)rgb.copy(node.material.color);else rgb.setRGB(1,1,1)
        world.multiplyMatrices(node.matrixWorld,mx)
        objects.push({mesh,m:world.toArray(),c:rgb.toArray(),p:true,vc:Boolean(node.material.vertexColors),s:node.material.name})
      }
    }else{
      objects.push({mesh,m:node.matrixWorld.toArray(),c:color(node.material),p:false,vc:Boolean(node.material.vertexColors),s:node.material.name})
    }
  }
  node.children.forEach(walk)
}
walk(root)
await renderer.unmount()
const views=[
  {id:'10-portret',x:21.6,z:195.8,y:4.33,look:[24,4.26,195]},
  {id:'11-crab',x:36,z:198.45,y:3.16,look:[37,2.71,197]},
  {id:'00-panorama',x:102,z:240,y:64,look:[-15,14,91]},
  {id:'01-plaja',x:28,z:198,y:height(28,198)+2.2,look:[10,3.2,188]},
  {id:'02-padure',x:-10,z:153,y:height(-10,153)+1.7,look:[-23,10.7,128]},
  {id:'03-tabara',x:-60,z:72,y:height(-60,72)+1.9,look:[-78,16.3,60]},
  {id:'04-cascada',x:-108,z:-51,y:17.98,look:[-110,20.6,-76]},
  {id:'05-ruine',x:5,z:-23,y:24.1,look:[5,25.2,-45]},
  {id:'06-turn',x:69,z:-82,y:height(69,-82)+2.4,look:[78,49,-110]},
  {id:'06b-belvedere',x:77.2,z:-110.2,y:floor(77.2,-110.2)+1.86,look:[145,17,11]},
  {id:'07-coasta',x:221,z:0,y:height(221,0)+3.2,look:[245,.42,-28]},
  {id:'08-arhiva',x:162,z:37.9,y:8.75,look:[174,8.8,39.4]}
]
views.push({id:'12-copaci',x:-29,z:143,y:height(-29,143)+2.05,look:[-35,15.9,127]})
views.push(
 {id:'14-epava',x:24,z:195.4,y:4.55,look:[14.2,3.15,194.8]},
 {id:'14-butuc',x:-9,z:151,y:height(-9,151)+1.36,look:[-8,10.46,157.5]},
 {id:'14-stanca',x:38,z:197,y:height(38,197)+1.66,look:[40.7,1.7,200.6]},
 {id:'14-tabara',x:-66.3,z:72,y:15.75,look:[-79,14.8,59]},
)
const optics=new T.PerspectiveCamera(71,1.6,.12,960)
aimScope(optics,scope.heading)
const center=optics.position.clone().addScaledVector(optics.getWorldDirection(new T.Vector3()),160)
views.push({id:'14-luneta',x:optics.position.x,y:optics.position.y,z:optics.position.z,look:center.toArray(),lens:107,near:optics.near})
const subset=process.argv.slice(3)
const selected=subset.length?views.filter(view=>subset.includes(view.id)):views
await writeFile(process.argv[2],JSON.stringify({meshes,objects,views:selected}))
await writeFile(join(dirname(process.argv[2]),'canopy.webp'),Buffer.from(canopyPixels.split(',')[1],'base64'))
for(const [name,asset] of Object.entries(openingScans)){
  await writeFile(join(dirname(process.argv[2]),'opening-'+name+'.webp'),Buffer.from(asset.diffuse.split(',')[1],'base64'))
  await writeFile(join(dirname(process.argv[2]),'opening-'+name+'-nor.webp'),Buffer.from(asset.normal.split(',')[1],'base64'))
}
console.log({meshCount:meshes.length,objects:objects.length,views:selected.length})
