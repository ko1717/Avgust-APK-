import {createRoot} from 'react-dom/client';
import Workspace from '../app/workspace';
import '../app/globals.css';
import {applyStoredTheme} from '../lib/theme';

applyStoredTheme();

async function main(){
 if(!(window as Window & {careDesktop?:unknown}).careDesktop){
  const {startDeviceRuntime}=await import('../lib/device-runtime');
  await startDeviceRuntime();
 }
 createRoot(document.getElementById('root')!).render(<Workspace desktop/>);
}
void main();
