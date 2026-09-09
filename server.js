import{createServer}from'node:http';import{readFileSync,existsSync,statSync,watch}from'node:fs';import{extname,join,resolve,sep}from'node:path';

const root=process.cwd(),envFile=process.env.VAULT_ENV_FILE||join(root,'.env');
if(existsSync(envFile))for(const raw of readFileSync(envFile,'utf8').split(/\r?\n/)){const line=raw.trim();if(!line||line.startsWith('#')||!line.includes('='))continue;const [name,...parts]=line.split('=');let value=parts.join('=').trim();if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);if(!process.env[name.trim()])process.env[name.trim()]=value}
const port=Number(process.env.PORT||4175),host='127.0.0.1',model=process.env.OPENAI_MODEL||'gpt-5.6-terra',effort=process.env.OPENAI_REASONING_EFFORT||'medium',apiKey=process.env.OPENAI_API_KEY||process.env.OPENAI_KEY,allowPublicAI=process.env.ALLOW_PUBLIC_AI==='true';
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const liveClients=new Set();
const json=(response,status,payload)=>{response.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});response.end(JSON.stringify(payload))};
const body=async(request,limit=64_000)=>{let data='';for await(const chunk of request){data+=chunk;if(data.length>limit)throw new Error('Payload demasiado grande')}return JSON.parse(data||'{}')};
const outputText=response=>response.output_text||response.output?.flatMap(item=>item.content||[]).find(item=>item.type==='output_text')?.text||'';
const isFunnelRequest=request=>(request.headers.host||'').split(':')[0].endsWith('.ts.net');
const publicAIBlocked=(request,response)=>{if(isFunnelRequest(request)&&!allowPublicAI){json(response,403,{error:'AI only available in trusted local sessions.'});return true}return false};

async function chat(request,response){
  if(publicAIBlocked(request,response))return;
  if(!apiKey)return json(response,503,{error:'OPENAI_KEY no esta configurada en el servidor.'});
  try{
    const payload=await body(request),message=String(payload.message||'').trim();if(!message||message.length>4000)return json(response,400,{error:'Mensaje invalido.'});
    const history=Array.isArray(payload.history)?payload.history.slice(-10).filter(item=>['user','assistant'].includes(item.role)&&typeof item.content==='string').map(item=>({role:item.role,content:item.content.slice(0,4000)})):[];
    const upstream=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({model,reasoning:{effort},store:false,max_output_tokens:500,instructions:'Eres Lumen, el agente privado dentro de GNX Vault. Responde en espanol, directo y calido. Ayuda a convertir intenciones en decisiones, acuerdos y siguientes pasos. No inventes conexiones ni acciones ejecutadas. Usa como maximo 90 palabras.',input:[...history,{role:'user',content:message}]})});
    const data=await upstream.json();if(!upstream.ok)throw new Error(data.error?.message||`OpenAI ${upstream.status}`);const text=outputText(data);if(!text)throw new Error('La respuesta no incluyo texto.');json(response,200,{text,model,effort,responseId:data.id});
  }catch(error){console.error('[vault-ai]',error.message);json(response,502,{error:'Lumen no pudo responder en este momento.'})}
}

async function transcribe(request,response){
  if(publicAIBlocked(request,response))return;
  if(!apiKey)return json(response,503,{error:'OPENAI_KEY no esta configurada en el servidor.'});
  try{
    const payload=await body(request,5_500_000),encoded=String(payload.audio||'').replace(/\s/g,''),mime=String(payload.mime||'audio/webm');
    if(!encoded||encoded.length>5_200_000||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))return json(response,400,{error:'Audio invalido.'});
    const bytes=Buffer.from(encoded,'base64');if(bytes.length<800||bytes.length>3_900_000)return json(response,400,{error:'Audio fuera de limite.'});
    const safeMime=['audio/webm','audio/webm;codecs=opus','audio/ogg','audio/ogg;codecs=opus','audio/mp4'].includes(mime)?mime:'audio/webm',extension=safeMime.includes('ogg')?'ogg':safeMime.includes('mp4')?'m4a':'webm';
    const form=new FormData();form.set('model','gpt-4o-mini-transcribe');form.set('language','es');form.set('file',new Blob([bytes],{type:safeMime}),`vault-note.${extension}`);
    const upstream=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{authorization:`Bearer ${apiKey}`},body:form}),data=await upstream.json();if(!upstream.ok)throw new Error(data.error?.message||`OpenAI ${upstream.status}`);const text=String(data.text||'').trim();if(!text)throw new Error('La transcripcion no incluyo texto.');json(response,200,{text,model:'gpt-4o-mini-transcribe'});
  }catch(error){console.error('[vault-transcribe]',error.message);json(response,502,{error:'No pude transcribir este audio.'})}
}

const server=createServer(async(request,response)=>{
  const url=new URL(request.url,'http://localhost');
  if(url.pathname==='/api/health'){const ai=Boolean(apiKey)&&(!isFunnelRequest(request)||allowPublicAI);return json(response,200,{ok:true,ai,model,effort,mode:ai?'openai':'mock',publicAI:allowPublicAI})}
  if(url.pathname==='/api/chat'&&request.method==='POST')return chat(request,response);
  if(url.pathname==='/api/transcribe'&&request.method==='POST')return transcribe(request,response);
  if(url.pathname==='/__dev/events'){response.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store','connection':'keep-alive'});response.write('event: ready\ndata: connected\n\n');liveClients.add(response);request.on('close',()=>liveClients.delete(response));return}
  const pathname=url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname),file=resolve(root,'.'+pathname);if(!file.startsWith(root+sep)||!existsSync(file)||!statSync(file).isFile()){response.writeHead(404);return response.end('Not found')}
  response.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream','cache-control':'no-store'});response.end(readFileSync(file));
});
server.listen(port,host,()=>console.log(`GNX Vault dev · http://localhost:${port} · ${apiKey?`${model}/${effort}`:'mock (missing key)'}`));
let reloadTimer;const watcher=watch(root,{recursive:true},(_,name)=>{if(!name||name.startsWith('.git')||name.includes('node_modules'))return;clearTimeout(reloadTimer);reloadTimer=setTimeout(()=>{for(const client of liveClients)client.write(`event: reload\ndata: ${Date.now()}\n\n`)},120)});
process.on('SIGINT',()=>{watcher.close();for(const client of liveClients)client.end();server.close(()=>process.exit(0))});
