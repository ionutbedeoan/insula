import { build } from 'vite'
import { fileURLToPath } from 'node:url'

const fixture=fileURLToPath(new URL('./browser-frame.tsx',import.meta.url))
const outDir=process.argv[2]??'dist-browser-test'
await build({
  plugins:[{name:'webgl-free-browser-integration',enforce:'pre',resolveId(source,importer){
    if(source==='./scene.tsx'&&importer?.endsWith('/src/app.tsx'))return fixture
    if(source==='@react-three/fiber'&&importer?.endsWith('/src/player.tsx'))return fixture
  }}],
  build:{outDir,emptyOutDir:true}
})
