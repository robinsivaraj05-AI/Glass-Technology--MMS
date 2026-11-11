import toast from 'react-hot-toast';
let serverReady=false;
let warmupPromise:Promise<void>|null=null;
async function warmupServer():Promise<void>{
 for(let i=0;i<10;i++){try{const c=new AbortController();const t=setTimeout(()=>c.abort(),35000);const r=await fetch('/api/health',{signal:c.signal});clearTimeout(t);if(r.ok||r.status<500){serverReady=true;return;}}catch{} if(i<9)await new Promise(r=>setTimeout(r,6000));}
}
export function startServerWarmup(){if(!warmupPromise)warmupPromise=warmupServer();}
let wakeToastId:string|null=null;
export async function apiFetch(path:string,opts:RequestInit={}):Promise<any>{
 if(!serverReady){if(!warmupPromise)startServerWarmup();if(!wakeToastId)wakeToastId=toast.loading('Server is starting up, please wait…',{duration:120000});await warmupPromise;if(wakeToastId){toast.dismiss(wakeToastId);wakeToastId=null;}}
 const delays=[5000,10000,15000,20000];
 for(let attempt=0;attempt<=4;attempt++){try{
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),40000);
  const headers=new Headers(opts.headers||{});\n  const token=sessionStorage.getItem('mms_token');\n  if(token && !token.startsWith('demo-jwt-token-')) headers.set('Authorization', 'Bearer '+token);
  if(!(opts.body instanceof FormData)&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
  const res=await fetch(path,{...opts,headers,signal:controller.signal});clearTimeout(timeout);
  if((res.status===503||res.status===429)&&attempt<4){if(!wakeToastId)wakeToastId=toast.loading('Server is starting up, please wait…',{duration:60000});await new Promise(r=>setTimeout(r,res.status===429?delays[attempt]*2:delays[attempt]));continue;}
  if(wakeToastId){toast.dismiss(wakeToastId);wakeToastId=null;}
  if(!res.ok){const e=await res.json().catch(()=>({message:res.statusText}));throw new Error(e.message||('Request failed ('+res.status+')'));}
  return res.json();
 }catch(err:any){const last=attempt===4;const network=err instanceof TypeError||err.name==='AbortError';if(network&&!last){if(attempt===0&&!wakeToastId)wakeToastId=toast.loading('Server is starting up, please wait…',{duration:60000});await new Promise(r=>setTimeout(r,delays[attempt]));continue;}if(wakeToastId){toast.dismiss(wakeToastId);wakeToastId=null;}throw err.name==='AbortError'?new Error('Request timed out. Server may be starting up — try again.'):err;}}
}
