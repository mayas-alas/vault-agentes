const base='/api/whatsapp/client/';
let generation=0,pendingSend=null;
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
async function api(path,method='GET',payload){
  const options={method,cache:'no-store',headers:{}};
  if(payload){options.headers['content-type']='application/json';options.body=JSON.stringify(payload)}
  const response=await fetch(base+path,options),data=await response.json();
  if(!response.ok)throw Error(data.error||'No se pudo acceder a WhatsApp.');return data;
}
const closeModal=()=>{const modal=document.querySelector('#modal');modal.hidden=true;document.body.style.overflow=''};
export async function openClient(){
  const run=++generation,modal=document.querySelector('#modal'),content=document.querySelector('#modal-content');
  modal.hidden=false;document.body.style.overflow='hidden';
  content.innerHTML='<div class="modal-brand"><span class="service-icon" style="--service:#9af0b6">WA</span><span class="kicker">IDENTIDAD SEGURA</span></div><h3 id="modal-title">Entra con WhatsApp.</h3><p class="modal-copy">Escanea el código desde Dispositivos vinculados. Tu número identifica esta sesión local del vault.</p><div class="whatsapp-qr"><img hidden alt="Código QR para iniciar sesión"><span>Preparando QR…</span></div><p role="status" id="client-status" class="modal-copy">Conectando con Hermes…</p><button class="button ghost modal-action" id="client-retry">Generar otro QR</button>';
  const status=content.querySelector('#client-status'),img=content.querySelector('img'),hint=content.querySelector('.whatsapp-qr span');
  content.querySelector('#client-retry').onclick=async()=>{await api('new','POST');openClient()};
  try{
    let data=await api('session','POST');
    while(run===generation&&!modal.hidden){
      if(data.status==='error')throw Error(data.error);
      if(data.status==='connected'){
        hint.hidden=false;img.hidden=true;hint.textContent='✓';status.textContent='Identidad confirmada. Abriendo tu vault…';
        await new Promise(resolve=>setTimeout(resolve,450));closeModal();document.dispatchEvent(new CustomEvent('vault-authenticated',{detail:{phone:data.phone}}));return;
      }
      if(data.qrDataUrl){img.src=data.qrDataUrl;img.hidden=false;hint.hidden=true;status.textContent='Escanea el QR. Se renueva automáticamente.'}
      else status.textContent=data.status==='connecting'?'Confirmando con WhatsApp…':'Preparando QR…';
      await new Promise(resolve=>setTimeout(resolve,1500));data=await api('session');
    }
  }catch(error){if(run===generation){img.hidden=true;hint.hidden=false;hint.textContent='!';status.textContent=error.message}}
}
async function directory(){
  const data=await api('conversations'),contacts=new Map((data.contacts||[]).map(contact=>[contact.id,contact]));
  for(const message of data.messages||[])if(!contacts.has(message.chat))contacts.set(message.chat,{id:message.chat,name:message.name});
  return {...data,contacts:[...contacts.values()]};
}
const escapeHTML=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export async function openContacts(query=''){
  const modal=document.querySelector('#modal'),content=document.querySelector('#modal-content');modal.hidden=false;document.body.style.overflow='hidden';
  content.innerHTML='<div class="modal-brand"><span class="kicker">CTRL + K</span></div><h3 id="modal-title">Contactos.</h3><input id="contact-search" placeholder="Busca por nombre o número…" aria-label="Buscar contacto"><div id="contact-results"></div><div id="contact-detail"></div>';
  const search=content.querySelector('input'),results=content.querySelector('#contact-results'),detail=content.querySelector('#contact-detail');search.value=query;search.focus();
  try{
    const {contacts}=await directory();
    const render=()=>{results.textContent='';detail.textContent='';const needle=normalize(search.value),found=contacts.filter(contact=>normalize(contact.name+' '+contact.id).includes(needle)).slice(0,40);
      if(!found.length)results.textContent='No encontré contactos sincronizados.';
      for(const contact of found){const button=document.createElement('button');button.className='contact-result';button.innerHTML=`<span>${escapeHTML(contact.name||'Sin nombre')}</span><small>${escapeHTML(contact.id.split('@')[0])}</small>`;button.onclick=()=>showSendConfirmation(contact,'');results.append(button)}};
    search.oninput=render;render();
  }catch(error){results.textContent=error.message;setTimeout(openClient,700)}
}
function showSendConfirmation(contact,message){
  pendingSend={contact,message};const experience=document.querySelector('#vault-experience'),panel=document.querySelector('#vault-guided-panel');
  if(experience&&!experience.hidden&&panel){closeModal();panel.hidden=false;panel.innerHTML=`<div class="vault-quiz-top"><span>CONFIRMAR WHATSAPP</span><button id="cancel-send" aria-label="Cancelar">×</button></div><strong>Mensaje para ${escapeHTML(contact.name)}</strong><textarea id="send-message" rows="3" placeholder="Escribe el mensaje…">${escapeHTML(message)}</textarea><div class="send-actions"><button id="confirm-send">Confirmar envío</button><button id="cancel-send-button">Cancelar</button></div><small id="send-status" role="status">Puedes editarlo o decir “confirmar envío”.</small>`;wireSendConfirmation(panel,()=>{panel.hidden=true;panel.textContent=''});return;
  }
  const modal=document.querySelector('#modal'),content=document.querySelector('#modal-content');modal.hidden=false;document.body.style.overflow='hidden';
  content.innerHTML=`<div class="modal-brand"><span class="kicker">CONFIRMAR ACCIÓN</span></div><h3 id="modal-title">Mensaje para ${escapeHTML(contact.name)}.</h3><p class="modal-copy">Lumen enviará este mensaje desde tu WhatsApp vinculado.</p><textarea id="send-message" rows="4" placeholder="Escribe el mensaje…">${escapeHTML(message)}</textarea><button class="button primary modal-action" id="confirm-send">Confirmar envío</button><button class="button ghost modal-action" id="cancel-send-button">Cancelar</button><p class="modal-copy" id="send-status" role="status">Revisa el contenido antes de enviarlo.</p>`;wireSendConfirmation(content,closeModal);
}
function wireSendConfirmation(root,onClose){
  const textarea=root.querySelector('#send-message');textarea.focus();textarea.oninput=event=>pendingSend.message=event.target.value;
  textarea.onkeydown=event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();root.querySelector('#confirm-send').click()}};
  root.querySelector('#confirm-send').onclick=async()=>{const status=root.querySelector('#send-status'),button=root.querySelector('#confirm-send');button.disabled=true;status.textContent='Enviando desde tu sesión…';try{const result=await confirmPendingSend();status.textContent=result;button.textContent='Enviado ✓';setTimeout(onClose,900)}catch(error){status.textContent=error.message;button.disabled=false}};
  const cancel=()=>{pendingSend=null;onClose()};root.querySelector('#cancel-send')?.addEventListener('click',cancel);root.querySelector('#cancel-send-button').onclick=cancel;
}
async function confirmPendingSend(){
  if(!pendingSend)throw Error('No hay un mensaje pendiente.');const {contact,message}=pendingSend;if(!message.trim())throw Error('El mensaje está vacío.');
  const result=await api('send','POST',{contactId:contact.id,message:message.trim()});if(!result.messageId)throw Error('WhatsApp no confirmó el mensaje. Intenta de nuevo.');pendingSend=null;return `WhatsApp aceptó el mensaje para ${contact.name}. ID ${result.messageId}.`;
}
function parseSend(text){
  return text.match(/(?:m[aá]nda(?:le)?|env[ií]a(?:le)?)\s+(?:a\s+)?(?:mi\s+contacto\s+)?(.+?)\s+(?:el\s+)?(?:mensaje|recordatorio)(?:\s+(?:de\s+)?)?(.+)/i);
}
export async function whatsappVoice(text){
  if(/\b(?:confirma|confirmar)(?:\s+el)?(?:\s+env[ií]o)?\b/i.test(text)&&pendingSend){const result=await confirmPendingSend(),panel=document.querySelector('#vault-guided-panel');if(panel){panel.hidden=true;panel.textContent=''}return result}
  if(/\b(?:cancela|cancelar)(?:\s+el)?(?:\s+env[ií]o)?\b/i.test(text)&&pendingSend){pendingSend=null;closeModal();const panel=document.querySelector('#vault-guided-panel');if(panel){panel.hidden=true;panel.textContent=''}return 'Envío cancelado.'}
  const command=parseSend(text);
  if(command){
    const requested=normalize(command[1]),message=command[2].trim(),{contacts}=await directory();
    const exact=contacts.filter(contact=>normalize(contact.name)===requested||normalize(contact.id.split('@')[0])===requested);
    const matches=exact.length?exact:contacts.filter(contact=>normalize(contact.name).includes(requested)||requested.includes(normalize(contact.name)));
    if(matches.length!==1){openContacts(command[1]);return matches.length?'Encontré varios contactos. Elige uno con Ctrl+K.':'No encontré ese contacto. Abrí Ctrl+K para buscarlo.'}
    showSendConfirmation(matches[0],message);return `Preparé el mensaje para ${matches[0].name}. Di “confirmar envío” o revisa el panel.`;
  }
  if(/conversacion|conversaci[oó]n|historial|[uú]ltim|resumen|contacto/i.test(text)){
    const {messages,contacts}=await directory();if(!messages.length)return 'WhatsApp aún no sincronizó conversaciones.';
    const chats=new Map();for(const message of messages)chats.set(message.chat,message);
    return `Tengo ${messages.length} mensajes en ${contacts.length} contactos. Recientes: ${[...chats.values()].slice(-5).map(message=>`${message.name}: ${message.text.slice(0,120)}`).join('. ')}`;
  }
  if(/conect|vincul|c[oó]digo|\bqr\b|whats\s*app/i.test(text)){openClient();return 'Abro tu acceso por WhatsApp.'}
  return null;
}
function openEmail(){
  const modal=document.querySelector('#modal'),content=document.querySelector('#modal-content');modal.hidden=false;document.body.style.overflow='hidden';
  content.innerHTML='<div class="modal-brand"><span class="kicker">CONEXIÓN</span></div><h3 id="modal-title">Linkear email.</h3><p class="modal-copy">Guardaremos el correo en esta sesión. La entrega del email de confirmación queda pendiente.</p><form id="email-form"><input type="email" required placeholder="tu@correo.com" aria-label="Email"><button class="button primary modal-action">Guardar correo</button></form><p id="email-status" role="status"></p>';
  content.querySelector('form').onsubmit=event=>{event.preventDefault();sessionStorage.setItem('vault-email',content.querySelector('input').value);content.querySelector('#email-status').textContent='Correo guardado · verificación pendiente. No se envió ningún email.'};
}
export function initClient(){
  document.querySelectorAll('[data-vault-entry]').forEach(button=>{button.innerHTML='Entrar con WhatsApp <span>↗</span>'});
  const actions=document.querySelector('.vault-os-actions'),contacts=document.createElement('button');contacts.textContent='Contactos · Ctrl+K';contacts.onclick=()=>openContacts();actions.prepend(contacts);
  const logout=document.createElement('button');logout.textContent='Cerrar sesión';logout.dataset.logout='';actions.append(logout);
  logout.onclick=async()=>{logout.disabled=true;try{await api('logout','POST');for(const key of Object.keys(localStorage))if(key.startsWith('gnx-'))localStorage.removeItem(key);sessionStorage.clear();localStorage.setItem('vault-logout',String(Date.now()));location.reload()}catch(error){logout.disabled=false;logout.textContent=error.message}};
  addEventListener('storage',event=>{if(event.key==='vault-logout')location.reload()});
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();openContacts()}});
  document.addEventListener('click',event=>{if(event.target.closest('[data-connect="email"], [data-vault-provider="email"]')){event.stopImmediatePropagation();openEmail()}},true);
  setTimeout(async()=>{try{const state=await api('session','POST');if(state.status==='connected')document.dispatchEvent(new CustomEvent('vault-authenticated',{detail:{phone:state.phone}}))}catch{}},100);
}
