// Executed inside Hermes. Each local browser gets a separate account directory.
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync,rmSync} from 'node:fs';
import {createInterface} from 'node:readline';
const require=createRequire('/opt/data/scripts/whatsapp-bridge/package.json');
const {makeWASocket,useMultiFileAuthState,fetchLatestBaileysVersion,DisconnectReason,Browsers}=await import(pathToFileURL(require.resolve('@whiskeysockets/baileys')).href);
const pino=require('pino');
const id=process.argv[1];
if(!/^[a-f0-9]{64}$/.test(id))throw Error('Invalid session');
process.umask(0o077);
const dir='/opt/data/vault-clients/'+id;
mkdirSync(dir,{recursive:true,mode:0o700});
const read=(file,fallback)=>{try{return JSON.parse(readFileSync(dir+'/'+file,'utf8'));}catch{return fallback;}};
const save=(file,data)=>{writeFileSync(dir+'/'+file+'.tmp',JSON.stringify(data));renameSync(dir+'/'+file+'.tmp',dir+'/'+file);};
let messages=read('recent.json',[]),contacts=read('contacts.json',{}),sock,closed=false,retries=0;
const emit=data=>console.log(JSON.stringify(data));
const phone=jid=>String(jid||'').split('@')[0].split(':')[0];
const snapshot=()=>emit({event:'snapshot',messages:messages.slice(-100),contacts:Object.entries(contacts).map(([id,name])=>({id,name}))});
function capture(items){
  for(const m of items||[]){
    const jid=m.key?.remoteJid,mid=m.key?.id;
    if(!jid||!mid||jid==='status@broadcast')continue;
    let content=m.message;
    for(let i=0;i<3;i++)content=content?.ephemeralMessage?.message||content?.viewOnceMessage?.message||content;
    const text=content?.conversation||content?.extendedTextMessage?.text||content?.imageMessage?.caption||content?.videoMessage?.caption;
    if(!text)continue;
    if(!messages.some(x=>x.id===mid&&x.chat===jid))messages.push({id:mid,chat:jid,name:contacts[jid]||m.pushName||phone(jid),fromMe:Boolean(m.key.fromMe),text:String(text).slice(0,8000),timestamp:Number(m.messageTimestamp)*1000});
  }
  messages.sort((a,b)=>a.timestamp-b.timestamp);messages=messages.slice(-500);
  save('recent.json',messages);snapshot();
}
async function connect(){
  const {state,saveCreds}=await useMultiFileAuthState(dir+'/auth');
  let version;
  try{version=(await fetchLatestBaileysVersion()).version;}catch{}
  sock=makeWASocket({auth:state,...(version?{version}:{}),logger:pino({level:'silent'}),browser:['Hermes Agent','Chrome','120.0'],syncFullHistory:true,shouldSyncHistoryMessage:()=>true,markOnlineOnConnect:false,getMessage:async()=>undefined});
  sock.ev.on('creds.update',saveCreds);
  sock.ev.on('contacts.upsert',items=>{for(const c of items)contacts[c.id]=c.name||c.notify||phone(c.id);save('contacts.json',contacts);});
  sock.ev.on('messaging-history.set',data=>{for(const c of data.contacts||[])contacts[c.id]=c.name||c.notify||phone(c.id);save('contacts.json',contacts);capture(data.messages);});
  sock.ev.on('messages.upsert',data=>capture(data.messages));
  sock.ev.on('connection.update',update=>{
    if(update.qr)emit({event:'state',status:'waiting',qr:update.qr,expiresAt:new Date(Date.now()+20000).toISOString()});
    if(update.connection==='open'){
      retries=0;emit({event:'state',status:'connected',phone:phone(sock.user.id)});snapshot();
    }
    if(update.connection==='close'&&!closed){
      const code=update.lastDisconnect?.error?.output?.statusCode;
      if(code===DisconnectReason.loggedOut||++retries>8){emit({event:'state',status:'error',error:'Sesión desconectada. Desvincula este dispositivo y crea otra sesión local.'});process.exit(1);}
      emit({event:'state',status:'connecting',code});setTimeout(()=>connect().catch(fail),code===515?1000:3000);
    }
  });
}
function fail(){emit({event:'state',status:'error',error:'No se pudo conectar el cliente de WhatsApp.'});process.exit(1);}
process.on('SIGTERM',()=>{closed=true;sock?.end(undefined);process.exit(0);});
createInterface({input:process.stdin}).on('line',async line=>{
  if(line==='logout'){
    closed=true;
    try{await Promise.race([sock?.logout(),new Promise(resolve=>setTimeout(resolve,4000))]);}catch{}
    sock?.end(undefined);
    if(dir==='/opt/data/vault-clients/'+id && /^[a-f0-9]{64}$/.test(id))rmSync(dir,{recursive:true,force:true});
    process.exit(0);
  }
  try{
    const command=JSON.parse(line);
    if(command.type!=='send'||!command.requestId)return;
    if(!sock?.user)throw Error('La sesión de WhatsApp no está conectada.');
    const sent=await sock.sendMessage(command.chatId,{text:command.message});
    emit({event:'sendResult',requestId:command.requestId,ok:true,messageId:sent?.key?.id});
  }catch(error){
    let requestId;try{requestId=JSON.parse(line).requestId}catch{}
    emit({event:'sendResult',requestId,ok:false,error:error?.message||'WhatsApp rechazó el envío.'});
  }
});
setTimeout(()=>{if(!sock?.user){emit({event:'state',status:'error',error:'El QR expiró. Reintenta.'});process.exit(1);}},600000).unref();
connect().catch(fail);
