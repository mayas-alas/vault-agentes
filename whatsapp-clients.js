import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomBytes,createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {mkdirSync,existsSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';
import QRCode from 'qrcode';
import {loadWorkspaces,seedIntroductions,contextRevision,newWorkspace,askLumen} from './workspaces.js';
const dir=join(process.env.LOCALAPPDATA||homedir(),'gnx-vault-local');mkdirSync(dir,{recursive:true});
const keyFile=join(dir,'cookie.key');
if(!existsSync(keyFile))writeFileSync(keyFile,randomBytes(32),{mode:0o600,flag:'wx'});
const secret=readFileSync(keyFile),clients=new Map();
const readJson=async request=>{let raw='';for await(const chunk of request){raw+=chunk;if(raw.length>16_000)throw Error('Solicitud demasiado grande.')}return JSON.parse(raw||'{}')};
const sendThroughClient=(client,payload)=>new Promise((resolve,reject)=>{
  if(!client.worker?.stdin?.writable)return reject(Error('La sesión de WhatsApp no está disponible.'));
  const requestId=randomBytes(12).toString('hex'),timer=setTimeout(()=>{client.pending.delete(requestId);reject(Error('WhatsApp no confirmó el envío.'))},70000);
  client.pending.set(requestId,result=>{clearTimeout(timer);result.ok?resolve(result):reject(Error(result.error||'WhatsApp rechazó el envío.'))});
  client.worker.stdin.write(JSON.stringify({type:payload.type||'send',requestId,...payload})+'\n');
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
    if(data.event==='snapshot'){client.messages=data.messages;client.contacts=data.contacts||[];seedIntroductions(client.workspaceStore,client.messages);}
    if(data.event==='sendResult'){const complete=client.pending.get(data.requestId);if(complete){client.pending.delete(data.requestId);complete(data);}}
  }catch{}}});
  let workerError='';
  child.stderr.on('data',chunk=>{workerError=(workerError+chunk).slice(-2000);});
  child.on('error',()=>{client.state={status:'error',error:'No se pudo acceder a WSL.'};});
  child.on('close',(code,signal)=>{client.worker=null;const detail=workerError.trim().split('\n').at(-1);for(const complete of client.pending.values())complete({ok:false,error:detail||'La sesión de WhatsApp se cerró.'});client.pending.clear();if(client.state.status!=='error')client.state={status:'error',error:detail||`Cliente detenido (${signal||(code??'sin código')}). Reintenta conectar.`};});
}
export function workspaceContext(req,res){
  const client=clients.get(identity(req,res));if(!client)return {workspaces:[],contacts:[]};
  const state=client.workspaceStore.state;
  return {workspaces:state.workspaces,contacts:Object.entries(state.members).slice(0,30).map(([id,member])=>({id,name:client.contacts.find(c=>c.id===id)?.name||id,...member,messages:client.messages.filter(m=>m.chat===id).slice(-12).map(({id,fromMe,text,timestamp})=>({id,fromMe,text:text.slice(0,800),timestamp}))})),availableMessages:client.messages.length};
}
export async function clientAPI(req,res,url){
  const reply=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
  const host=req.headers.host;
  if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host||'')||req.headers.origin&&req.headers.origin!==`http://${host}`)return reply(403,{error:'Local access only'});
  const id=identity(req,res);let client=clients.get(id);
  if(!client){client={state:{status:'idle'},messages:[],contacts:[],pending:new Map(),workspaceStore:loadWorkspaces(dir,id),inflight:new Map()};clients.set(id,client);}
  try{
    const store=client.workspaceStore;
    const knownContact=contactId=>[...(client.contacts||[]),...client.messages.map(m=>({id:m.chat,name:m.name}))].find(c=>c.id===contactId);
    const contactContext=contactId=>{const member=store.state.members[contactId]||null;return {contact:knownContact(contactId),membership:member,workspaces:store.state.workspaces.filter(c=>member?.workspaceIds?.includes(c.id)),messages:client.messages.filter(m=>m.chat===contactId).slice(-50).map(({id,fromMe,text,timestamp,status})=>({id,fromMe,text,timestamp,status}))}};
    if(url.pathname.endsWith('/workspaces')){
      if(req.method==='GET')return reply(200,{workspaces:store.state.workspaces,members:store.state.members});
      if(req.method==='POST'){
        const payload=await readJson(req),name=String(payload.name||'').trim().slice(0,80),goal=String(payload.goal||'').trim().slice(0,1000);
        if(!name)return reply(400,{error:'Escribe un nombre para la espacio.'});
        const workspace=newWorkspace(name,goal);store.state.workspaces.push(workspace);store.save();return reply(200,{workspace});
      }
    }
    if(url.pathname.endsWith('/membership')&&req.method==='POST'){
      const payload=await readJson(req),contactId=String(payload.contactId||'');
      if(!knownContact(contactId))return reply(403,{error:'Contacto fuera de esta sesión.'});
      if(payload.remove){delete store.state.members[contactId];delete store.state.summaries[contactId];store.state.excluded[contactId]=true;store.save();return reply(200,{ok:true});}
      const workspaceIds=[...(payload.workspaceIds||[payload.workspaceId]||[])].filter(id=>store.state.workspaces.some(c=>c.id===id));
      if(!workspaceIds.length)return reply(400,{error:'Selecciona al menos un espacio válido.'});
      const previous=store.state.members[contactId]||{};
      const stage=['inactive','active','presented','engaged','done'].includes(payload.stage)?payload.stage:previous.stage||'inactive';
      store.state.members[contactId]={...previous,workspaceIds,stage,notes:String(payload.notes??previous.notes??'').slice(0,3000),updatedAt:new Date().toISOString()};
      delete store.state.excluded[contactId];
      store.save();return reply(200,{member:store.state.members[contactId]});
    }
    if(url.pathname.endsWith('/merge')&&req.method==='POST'){
      const payload=await readJson(req),primaryId=String(payload.primaryId||''),duplicateId=String(payload.duplicateId||'');
      if(!primaryId||!duplicateId||primaryId===duplicateId||!knownContact(primaryId)||!knownContact(duplicateId))return reply(400,{error:'Selecciona dos contactos válidos y distintos.'});
      if(client.worker)await sendThroughClient(client,{type:'merge',sourceChat:duplicateId,targetChat:primaryId});
      client.messages=client.messages.map(message=>message.chat===duplicateId?{...message,chat:primaryId,mergedFrom:duplicateId}:message);
      const duplicate=client.contacts.find(contact=>contact.id===duplicateId),primary=client.contacts.find(contact=>contact.id===primaryId);
      client.contacts=client.contacts.filter(contact=>contact.id!==duplicateId);if(primary&&!primary.name&&duplicate?.name)primary.name=duplicate.name;
      const first=store.state.members[primaryId],second=store.state.members[duplicateId];
      if(first||second)store.state.members[primaryId]={...(second||{}),...(first||{}),workspaceIds:[...new Set([...(first?.workspaceIds||[]),...(second?.workspaceIds||[])])],notes:[first?.notes,second?.notes].filter(Boolean).join('\n\n'),updatedAt:new Date().toISOString()};
      delete store.state.members[duplicateId];delete store.state.summaries[primaryId];delete store.state.summaries[duplicateId];store.save();
      return reply(200,{ok:true,primaryId,duplicateId,messageCount:client.messages.filter(message=>message.chat===primaryId).length});
    }
    if(url.pathname.endsWith('/context')&&req.method==='GET'){
      const contactId=url.searchParams.get('contactId');if(!knownContact(contactId))return reply(404,{error:'Contacto no encontrado.'});
      const context=contactContext(contactId),revision=contextRevision(context.messages,context.membership,context.workspaces);
      return reply(200,{...context,summary:store.state.summaries[contactId]||null,revision});
    }
    if(url.pathname.endsWith('/summarize')&&req.method==='POST'){
      const {contactId}=await readJson(req);if(!knownContact(contactId))return reply(404,{error:'Contacto no encontrado.'});
      const context=contactContext(contactId);if(!context.membership?.workspaceIds?.length)return reply(400,{error:'Agrega el contacto a un espacio para contextualizarlo.'});
      if(!context.messages.length)return reply(400,{error:'Aún no hay mensajes sincronizados para resumir.'});
      const revision=contextRevision(context.messages,context.membership,context.workspaces),cached=store.state.summaries[contactId];
      if(cached?.revision===revision)return reply(200,{summary:cached});
      const summary=await askLumen('Resume en máximo 180 palabras con los apartados Contexto, Señales, Pendientes y Próximo paso. Cita fechas o IDs de los mensajes que sustentan las conclusiones. Si sólo hay una presentación enviada, dilo: no implica respuesta, interés ni aceptación.',context);
      store.state.summaries[contactId]={...summary,revision,messageCount:context.messages.length};store.save();return reply(200,{summary:store.state.summaries[contactId]});
    }
    if(url.pathname.endsWith('/draft')&&req.method==='POST'){
      const {contactId,flow}=await readJson(req);if(!knownContact(contactId))return reply(404,{error:'Contacto no encontrado.'});
      const instructions={followup:'Escribe un seguimiento breve, amable y sin presión, basado en el último intercambio.',meeting:'Propón coordinar una conversación. Pregunta disponibilidad; no inventes horarios ni citas confirmadas.',reply:'Redacta una respuesta útil al último mensaje recibido. No inventes información que no tengas.'};
      if(!instructions[flow])return reply(400,{error:'Flujo no disponible.'});
      const context=contactContext(contactId);if(!context.membership?.workspaceIds?.length)return reply(400,{error:'Agrega el contacto a un espacio primero.'});
      const draft=await askLumen(instructions[flow]+' Devuelve sólo el mensaje de WhatsApp, máximo 700 caracteres, identificándote como Lumen. Es un borrador para revisión.',context);return reply(200,{...draft,text:draft.text.slice(0,1000)});
    }
    if(url.pathname.endsWith('/brief')&&req.method==='POST'){
      const context=workspaceContext(req,res);
      if(!context.contacts.length)return reply(200,{text:'Todavía no hay contactos en espacios. Abre Ctrl+K, selecciona un contacto y agrégalo a un espacio.'});
      const result=await askLumen('Da un panorama breve de las espacios y contactos incorporados. Separa presentaciones enviadas, respuestas recibidas y próximos pasos propuestos. No des por aceptada un espacio sólo porque se envió un mensaje.',context);return reply(200,result);
    }
    if(url.pathname.endsWith('/logout')&&req.method==='POST'){
      revoked.add(id);writeFileSync(revokedFile,JSON.stringify([...revoked]));
      store.destroy();
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
      return reply(200,{messages:client.messages,contacts:client.contacts||[],status:client.state.status,workspaces:store.state.workspaces,members:store.state.members});
    }
    if(url.pathname.endsWith('/send')&&req.method==='POST'){
      if(!client.worker)return reply(401,{error:'Vincula WhatsApp para entrar.'});
      await waitForConnection(client);
      const payload=await readJson(req),contactId=String(payload.contactId||''),message=String(payload.message||'').trim();
      const known=new Set([...(client.contacts||[]).map(c=>c.id),...(client.messages||[]).map(m=>m.chat)]);
      if(!known.has(contactId))return reply(403,{error:'El contacto no pertenece a esta sesión.'});
      if(!message||message.length>1000)return reply(400,{error:'El mensaje debe tener entre 1 y 1000 caracteres.'});
      const sendKey=String(payload.requestId||randomBytes(12).toString('hex'));
      if(!/^[a-zA-Z0-9-]{12,80}$/.test(sendKey))return reply(400,{error:'Identificador de envío inválido.'});
      const fingerprint=createHash('sha256').update(contactId+'\n'+message).digest('hex');
      const previous=store.state.sends[sendKey];
      if(previous&&previous.fingerprint!==fingerprint)return reply(409,{error:'El identificador ya corresponde a otro mensaje.'});
      if(previous?.result)return reply(200,previous.result);
      if(previous&&!client.inflight.has(sendKey))return reply(409,{error:'Este envío quedó sin confirmación. Revisa WhatsApp antes de iniciar otro envío.'});
      if(!client.inflight.has(sendKey)){
        store.state.sends[sendKey]={fingerprint,startedAt:new Date().toISOString()};store.save();
        const sending=sendThroughClient(client,{chatId:contactId,message}).then(result=>{
          if(!result.messageId)throw Error('WhatsApp no confirmó el mensaje.');
          const response={ok:true,messageId:result.messageId,recipient:result.chatId,sentAt:new Date().toISOString()};
          store.state.sends[sendKey].result=response;
          if(payload.flow==='intro'&&store.state.members[contactId])Object.assign(store.state.members[contactId],{stage:'presented',introducedAt:response.sentAt,messageId:response.messageId});
          store.save();return response;
        }).finally(()=>client.inflight.delete(sendKey));
        client.inflight.set(sendKey,sending);
      }
      const result=await client.inflight.get(sendKey);
      if(!result.messageId)throw Error('WhatsApp no confirmó el mensaje.');
      return reply(200,result);
    }
    return reply(404,{error:'Not found'});
  }catch(error){return reply(503,{error:error.message});}
}
