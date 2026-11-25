import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app.tsx'
import { islandAudio } from './audio.ts'
import { Tenerife } from './tenerife.tsx'
import './style.css'

function Game(){
  const [exploringTenerife,setExploringTenerife]=useState(false)
  const returnFocus=useRef(false)
  if(exploringTenerife)return <Tenerife onExit={()=>{
    returnFocus.current=true
    setExploringTenerife(false)
  }}/>
  return <App focusTenerife={returnFocus.current} onExploreTenerife={()=>{
    islandAudio.suspend()
    setExploringTenerife(true)
  }}/>
}

createRoot(document.getElementById('root')!).render(<Game/>)
