'use client';
import {useEffect,useState} from 'react';
import {Download} from 'lucide-react';

type InstallPrompt=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};
export default function PwaInstall(){
 const [prompt,setPrompt]=useState<InstallPrompt|null>(null),[installed,setInstalled]=useState(false);
 useEffect(()=>{if('serviceWorker'in navigator)void navigator.serviceWorker.register('/sw.js').catch(()=>{});const ready=(event:Event)=>{event.preventDefault();setPrompt(event as InstallPrompt);};const done=()=>{setInstalled(true);setPrompt(null);};window.addEventListener('beforeinstallprompt',ready);window.addEventListener('appinstalled',done);return()=>{window.removeEventListener('beforeinstallprompt',ready);window.removeEventListener('appinstalled',done);};},[]);
 if(installed||!prompt)return null;
 return <button className="pwa-install" onClick={()=>void prompt.prompt().then(()=>prompt.userChoice).then(choice=>{if(choice.outcome==='accepted')setInstalled(true);else setPrompt(null);})}><Download size={17}/>Instalar en tablet</button>;
}
