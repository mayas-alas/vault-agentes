import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomBytes,createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {mkdirSync,existsSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';
import QRCode from 'qrcode';
const dir=join(process.env.LOCALAPPDATA||homedir(),'gnx-vault-local');mkdirSync(dir,{recursive:true});
const keyFile=join(dir,'cookie.key');
if(!existsSync(keyFile))writeFileSync(keyFile,randomBytes(32),{mode:0o600,flag:'wx'});
const secret=readFileSync(keyFile),clients=new Map();
const readJson=async request=>{let raw='';for await(const chunk of request){raw+=chunk;if(raw.length>16_000)throw Error('Solicitud demasiado grande.')}return JSON.parse(raw||'{}')};
const sendThroughClient=(client,payload)=>new Promise((resolve,reject)=>{
  if(!client.worker?.stdin?.writable)return reject(Error('La sesión de WhatsApp no está disponible.'));
  const requestId=randomBytes(12).toString('hex'),timer=setTimeout(()=>{client.pending.delete(requestId);reject(Error('WhatsApp no confirmó el envío.'))},70000);
  client.pending.set(requestId,result=>{clearTimeout(timer);result.ok?resolve(result):reject(Error(result.error||'WhatsApp rechazó el envío.'))});
  client.worker.stdin.write(JSON.stringify({type:'send',requestId,...payload})+'\n');
});
async function waitForConnection(client,timeout=20000){
  const deadline=Date.now()+timeout;
  while(client.worker&&client.state.status!=='error'&&Date.now()<deadline){
    if(client.state.status==='connected')return;
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw Error(client.state.error||'WhatsApp sigue reconectando. Intenta de nuevo.');
}
const revokedFile=join(dir,'revoked.json');
const revoked=new Set(existsSync(revokedFile)?JSON.parse(readFileSync(revokedFile,'utf8')):[]);
const sign=id=>createHmac('sha256',secret).update(id).digest('hex');
function identity(req,res){
  let token=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('vault_client='))?.slice(13)||'';
  let [id,signature]=token.split('.');
  if(!/^[a-f0-9]{64}$/.test(id||'')||!/^[a-f0-9]{64}$/.test(signature||'')||!timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(sign(id),'hex'))){
    id=randomBytes(32).toString('hex');res.setHeader('Set-Cookie',`vault_client=${id}.${sign(id)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000`);
  }
  if(revoked.has(id)){id=randomBytes(32).toString('hex');res.setHeader('Set-Cookie',`vault_client=${id}.${sign(id)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000`);}
  return id;
}
function start(client,id){
  if(client.worker)return;
  if([...clients.values()].filter(c=>c.worker).length>=6)throw Error('Máximo de seis sesiones locales activas.');
  client.state={status:'starting'};
  // Commands are written to stdin; Podman must keep it attached to the worker.
  const child=spawn('wsl.exe',['-d','Ubuntu-24.04','-u','root','--','podman','exec','-i','--user','10000:10000','gnx-hermes','node','--input-type=module','-e',readFileSync(new URL('./scripts/whatsapp-client.mjs',import.meta.url),'utf8'),id],{windowsHide:true});
  client.worker=child;let buffer='',revision=0;
  child.stdout.on('data',chunk=>{buffer+=chunk;let lines=buffer.split('\n');buffer=lines.pop();for(const line of lines){try{
    const data=JSON.parse(line);
    if(data.event==='state'){
      const seq=++revision;const {event,qr,...state}=data;client.state=state;
      if(qr)QRCode.toDataURL(qr,{width:320,margin:4}).then(image=>{if(seq===revision)client.state={...state,qrDataUrl:image};}).catch(()=>{});
    }
    if(data.event==='snapshot'){client.messages=data.messages;client.contacts=data.contacts||[];}
    if(data.event==='sendResult'){const complete=client.pending.get(data.requestId);if(complete){client.pending.delete(data.requestId);complete(data);}}
  }catch{}}});
  let workerError='';
  child.stderr.on('data',chunk=>{workerError=(workerError+chunk).slice(-2000);});
  child.on('error',()=>{client.state={status:'error',error:'No se pudo acceder a WSL.'};});
  child.on('close',(code,signal)=>{client.worker=null;const detail=workerError.trim().split('\n').at(-1);for(const complete of client.pending.values())complete({ok:false,error:detail||'La sesión de WhatsApp se cerró.'});client.pending.clear();if(client.state.status!=='error')client.state={status:'error',error:detail||`Cliente detenido (${signal||(code??'sin código')}). Reintenta conectar.`};});
}
export async function clientAPI(req,res,url){
  const reply=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
  const host=req.headers.host;
  if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host||'')||req.headers.origin&&req.headers.origin!==`http://${host}`)return reply(403,{error:'Local access only'});
  const id=identity(req,res);let client=clients.get(id);
  if(!client){client={state:{status:'idle'},messages:[],contacts:[],pending:new Map()};clients.set(id,client);}
  try{
    if(url.pathname.endsWith('/logout')&&req.method==='POST'){
      revoked.add(id);writeFileSync(revokedFile,JSON.stringify([...revoked]));
      client.worker?.stdin.end('logout\n');clients.delete(id);
      res.setHeader('Set-Cookie','vault_client=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
      return reply(200,{ok:true});
    }
    if(url.pathname.endsWith('/new')&&req.method==='POST'){
      // Detach browser identity, preserving the previous account for other tabs.
      const fresh=randomBytes(32).toString('hex');res.setHeader('Set-Cookie',`vault_client=${fresh}.${sign(fresh)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000`);return reply(200,{status:'idle'});
    }
    if(url.pathname.endsWith('/session')){
      if(req.method==='POST')start(client,id);else if(req.method!=='GET')return reply(405,{error:'Method not allowed'});
      return reply(200,{...client.state,messageCount:client.messages.length,localUser:createHash('sha256').update(id).digest('hex').slice(0,8)});
    }
    if(url.pathname.endsWith('/conversations')&&req.method==='GET'){
      if(client.state.status!=='connected')return reply(401,{error:'Vincula WhatsApp para entrar.'});
      return reply(200,{messages:client.messages.slice(-100),contacts:client.contacts||[],status:client.state.status});
    }
    if(url.pathname.endsWith('/send')&&req.method==='POST'){
      if(!client.worker)return reply(401,{error:'Vincula WhatsApp para entrar.'});
      await waitForConnection(client);
      const payload=await readJson(req),contactId=String(payload.contactId||''),message=String(payload.message||'').trim();
      const known=new Set([...(client.contacts||[]).map(c=>c.id),...(client.messages||[]).map(m=>m.chat)]);
      if(!known.has(contactId))return reply(403,{error:'El contacto no pertenece a esta sesión.'});
      if(!message||message.length>1000)return reply(400,{error:'El mensaje debe tener entre 1 y 1000 caracteres.'});
      const result=await sendThroughClient(client,{chatId:contactId,message});
      if(!result.messageId)throw Error('WhatsApp no confirmó el mensaje.');
      return reply(200,{ok:true,messageId:result.messageId,recipient:result.chatId,sentAt:new Date().toISOString()});
    }
    return reply(404,{error:'Not found'});
  }catch(error){return reply(503,{error:error.message});}
}
