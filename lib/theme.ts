const KEY='care360-theme';

export type Theme='light'|'dark';

export function readTheme():Theme{
 if(typeof localStorage==='undefined')return 'light';
 const saved=localStorage.getItem(KEY);
 if(saved==='dark'||saved==='light')return saved;
 return window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
}

export function applyTheme(theme:Theme){
 document.documentElement.classList.toggle('dark',theme==='dark');
 document.documentElement.style.colorScheme=theme;
 localStorage.setItem(KEY,theme);
 const meta=document.querySelector('meta[name="theme-color"]');
 if(meta)meta.setAttribute('content',theme==='dark'?'#122226':'#007fa3');
 window.dispatchEvent(new Event('care360-theme'));
}

export function applyStoredTheme(){
 if(typeof document==='undefined')return;
 applyTheme(readTheme());
}
