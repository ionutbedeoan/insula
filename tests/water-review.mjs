import { writeFile } from 'node:fs/promises'
import * as T from 'three'
import { makeSeaSurface } from '../src/water-surface.ts'
import { height } from '../src/world-data.ts'

const sea=makeSeaSurface(false)
const sky=new T.SphereGeometry(858,32,16)
const terrain=new T.PlaneGeometry(520,520,248,248).rotateX(-Math.PI/2)
const land=terrain.getAttribute('position')
for(let i=0;i<land.count;i++)land.setY(i,height(land.getX(i),land.getZ(i)))
const encode=values=>Buffer.from(values.buffer,values.byteOffset,values.byteLength).toString('base64')
const mesh=g=>({positions:encode(g.getAttribute('position').array),index:encode(Uint32Array.from(g.index.array))})
const camera=new T.PerspectiveCamera(61,16/9,.07,1300)
camera.position.set(31,4.1,198.7)
camera.lookAt(8,.2,239)
camera.updateMatrixWorld()
await writeFile(process.argv[2],JSON.stringify({
  sea:mesh(sea),offsets:encode(sea.getAttribute('shoreOffset').array),sky:mesh(sky),terrain:mesh(terrain),
  camera:{view:camera.matrixWorldInverse.toArray(),projection:camera.projectionMatrix.toArray(),position:camera.position.toArray()},
}))
