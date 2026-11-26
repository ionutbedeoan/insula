import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { networkInterfaces } from 'node:os'

const port=Number(process.argv[2]??4173)
if(!Number.isInteger(port)||port<1024||port>65535){
  console.error('Alege un port între 1024 și 65535.')
  process.exit(1)
}
const game=await readFile(new URL('../../dist/The-Forgotten-Island.html',import.meta.url)).catch(()=>{
  console.error('Lipsește jocul compilat. Rulează npm run build din rădăcina proiectului.')
  process.exit(1)
})
const supported=['/','/ruta','/favicon.ico']
const server=createServer((request,response)=>{
  const path=(request.url??'/').split('?')[0]
  if(request.method!=='GET'&&request.method!=='HEAD'){
    response.writeHead(405,{allow:'GET, HEAD'}).end()
  }else if(!supported.includes(path)){
    response.writeHead(404).end()
  }else if(path==='/'){
    response.writeHead(302,{location:'/ruta#drive','cache-control':'no-store'}).end()
  }else if(path==='/favicon.ico'){
    response.writeHead(204).end()
  }else{
    response.writeHead(200,{'content-type':'text/html; charset=utf-8','content-length':game.length,'cache-control':'no-store'})
    response.end(request.method==='HEAD'?undefined:game)
  }
})
server.on('error',error=>{
  console.error(error.code==='EADDRINUSE'?'Portul este ocupat. Închide serverul vechi sau specifică alt port.':error.message)
  process.exitCode=1
})
server.listen(port,'0.0.0.0',()=>{
  console.log(`Laptop   http://localhost:${port}/`)
  try{
    const ips=Object.values(networkInterfaces()).flat().filter(adapter=>adapter?.family==='IPv4'&&!adapter.internal)
    for(const adapter of ips)console.log(`Telefon  http://${adapter.address}:${port}/`)
    if(!ips.length)console.log('Conectează calculatorul la aceeași rețea Wi-Fi ca telefonul.')
  }catch{
    console.log(`Pe telefon deschide http://ADRESA-IP-A-PC-ULUI:${port}/`)
  }
  console.log('Lasă fereastra pornită pe durata jocului. Ctrl+C oprește serverul.')
})
