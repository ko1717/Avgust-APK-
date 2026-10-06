'use client';
import {useSyncExternalStore} from 'react';
import {Moon,Sun} from 'lucide-react';
import {applyTheme,readTheme,type Theme} from '@/lib/theme';

function subscribe(onStoreChange:()=>void){
 window.addEventListener('care360-theme',onStoreChange);
 return ()=>window.removeEventListener('care360-theme',onStoreChange);
}

export default function ThemeToggle(){
 const theme=useSyncExternalStore(subscribe,readTheme,():Theme=>'light');
 const dark=theme==='dark';
 return <button type="button" className="theme-toggle" onClick={()=>applyTheme(dark?'light':'dark')} aria-pressed={dark} aria-label={dark?'Cambiar a color claro':'Cambiar a color oscuro'} title={dark?'Color claro':'Color oscuro'}>
  {dark?<Sun size={18}/>:<Moon size={18}/>}
  <span>{dark?'Claro':'Oscuro'}</span>
 </button>;
}
