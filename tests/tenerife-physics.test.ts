import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { CatmullRomCurve3, Vector3 } from 'three'

type Car = { x:number; z:number; y:number; heading:number; pitch:number; roll:number }
type Obstacle = { x:number; z:number; radius:number; halfX?:number; halfZ?:number; angle?:number }
const code=readFileSync(new URL('../src/tenerife/physics.js',import.meta.url),'utf8')
const { ground, collides }=runInNewContext(code+'\n({ground:tenerifeGroundCar,collides:tenerifeVehicleHits})') as {
  ground:(car:Car,dt:number,terrain:(x:number,z:number)=>number)=>void
  collides:(x:number,z:number,heading:number,obstacles:Obstacle[])=>boolean
}

test('the car rolls with a bank and keeps clearance across both sides throughout a turn',()=>{
  const height=(x:number,z:number)=>.18*x+.12*Math.sin(z*2.2)
  const car={x:0,z:0,y:0,heading:0,pitch:0,roll:0}
  ground(car,.01,height)
  assert.ok(car.roll<0)
  for(let heading=0;heading<2*Math.PI;heading+=.14){
    car.heading=heading
    ground(car,.01,height)
    for(const side of [-.91,.91]){
      for(const along of [-1.36,1.36]){
        const x=side*Math.cos(heading)+along*Math.sin(heading)
        const z=side*Math.sin(heading)-along*Math.cos(heading)
        const wheel=car.y-side*Math.sin(car.roll)+along*Math.sin(car.pitch)*Math.cos(car.roll)
        assert.ok(wheel>=height(x,z)-.016)
      }
    }
  }
})

test('a bumper corner hits buildings and small props even with the center clear',()=>{
  assert.equal(collides(0,0,0,[{x:1.19,z:-2.43,radius:.18}]),true)
  assert.equal(collides(0,0,0,[{x:1.8,z:-2,radius:.12}]),false)
  const building={x:2.2,z:0,radius:2.7,halfX:.42,halfZ:2.5,angle:.34}
  assert.equal(collides(0,0,Math.PI/2,[building]),true)
  assert.equal(collides(-5,0,Math.PI/2,[building]),false)
})

test('new streets add two kilometres with junctions close to the existing road elevations',()=>{
  const base=readFileSync(new URL('../Ruta-del-Viento/dist/The-Forgotten-Island.html',import.meta.url),'utf8')
  const extension=readFileSync(new URL('../src/tenerife/world.js',import.meta.url),'utf8')
  const relief=readFileSync(new URL('../src/tenerife/relief.js',import.meta.url),'utf8')
  const unity=JSON.parse(readFileSync(new URL('../Ruta-del-Viento-Desktop/Assets/Resources/Tenerife/Island.json',import.meta.url),'utf8'))
  const roadSource=base.slice(base.indexOf('const Vc='),base.indexOf('function Ws('))
    .replace('DA=[xi,mF,DF,wF,CF]','DA=[xi,mF,DF,wF,CF,...tenerifeRoads(Fg,X0),...tenerifeReliefRoutes(Fg,X0)]')
  const roads=runInNewContext(extension+relief+roadSource+';DA',{r9:CatmullRomCurve3,q:Vector3}) as {
    length:number; points:{x:number;y:number;z:number}[]
  }[]
  assert.equal(roads.length,21)
  assert.equal(unity.roads.length,roads.length)
  for(const [index,road] of roads.entries())assert.ok(Math.abs(road.length-unity.roads[index].length)<.01)
  assert.ok(roads.slice(5,13).reduce((total,road)=>total+road.length,0)>2200)
  for(const [index,road] of roads.slice(0,13).entries()){
    if(index<5)continue
    for(const previous of roads.slice(0,index)){
      for(const point of road.points){
        for(const neighbour of previous.points){
          if(Math.hypot(point.x-neighbour.x,point.z-neighbour.z)<2.25){
            assert.ok(Math.abs(point.y-neighbour.y)<1.15)
          }
        }
      }
    }
  }
})
