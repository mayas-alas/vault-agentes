const endpoint='/api/whatsapp/client/';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const date=value=>value?new Date(value).toLocaleString('es-MX',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Sin actividad';
const stages={inactive:'Inactivo',active:'Activo · saludar ahora',presented:'Presentado',engaged:'En conversación',done:'Completado'};
const intro='Hola, soy Lumen, el agente que acompaña esta espacio. Te escribo para presentarme y apoyar con el seguimiento y la coordinación. Cuando escriba yo, me identificaré como Lumen. ¿En qué podemos ayudarte?';
let version=0,poll;
document.addEventListener('keydown',event=>{
  const modal=document.querySelector('#modal');if(!modal||modal.hidden||!modal.classList.contains('command-center'))return;
  if(event.key==='Escape'){
    event.preventDefault();event.stopImmediatePropagation();modal.hidden=true;modal.classList.remove('command-center');clearInterval(poll);version++;
    document.body.style.overflow=document.querySelector('#vault-experience')?.hidden?'':'hidden';
    document.querySelector('[data-command-center]')?.focus();
  }
  if(event.key==='Tab'){
    const focusable=[...modal.querySelectorAll('button:not(:disabled),input,select,textarea:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length);
    const first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
  }
},true);
async function api(path,method='GET',body){
  const response=await fetch(endpoint+path,{method,cache:'no-store',headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  const data=await response.json();if(!response.ok)throw Error(data.error||'No pudimos completar la acción.');return data;
}
export async function openCommandCenter(query=''){
  const run=++version;clearInterval(poll);
  const modal=document.querySelector('#modal'),content=document.querySelector('#modal-content');
  modal.hidden=false;modal.classList.add('command-center');document.body.style.overflow='hidden';
  content.innerHTML=`<div class="cc-heading"><div><span class="kicker">LUMEN / WORKSPACE WORKSPACE</span><h3 id="modal-title">Conversaciones que avanzan.</h3><p>Contexto, personas y próximos pasos, en un mismo lugar.</p></div><span class="cc-live">● WhatsApp</span></div><div class="cc-toolbar"><label class="cc-search"><span>⌕</span><input id="contact-search" autocomplete="off" placeholder="Buscar contacto, número o conversación…" aria-label="Buscar contacto"><kbd>Ctrl K</kbd></label><button id="cc-new-workspace" class="cc-secondary">+ Espacio</button></div><div id="cc-workspace-form" hidden></div><div class="cc-filters" id="cc-filters"></div><div class="cc-workspace"><aside class="cc-directory"><div class="cc-list-heading"><span id="cc-count">Cargando contactos…</span><small>↑ ↓ · Enter</small></div><div id="contact-results" role="list" aria-label="Contactos"></div></aside><section id="contact-detail" class="cc-detail" aria-label="Ficha del contacto"><div class="cc-empty"><span class="cc-orbit">L</span><h4>Cada conversación tiene contexto.</h4><p>Selecciona a alguien para ver su actividad, incorporarlo a un espacio y elegir el siguiente movimiento.</p><small>Los mensajes se envían sólo al ejecutar un flujo.</small></div></section></div><div class="cc-footer"><span id="cc-status" role="status">Conectando con tu sesión…</span><span>Esc para cerrar</span></div>`;
  const search=content.querySelector('#contact-search'),results=content.querySelector('#contact-results'),detail=content.querySelector('#contact-detail'),status=content.querySelector('#cc-status');
  search.value=query;search.focus();
  let data={contacts:[],messages:[],members:{},workspaces:[]},filter='all',selected=null,selectionRun=0,visible=[],focusIndex=0,currentContext=null;
  const live=()=>run===version&&!modal.hidden&&content.querySelector('#cc-status')===status;
  const setStatus=text=>{if(live())status.textContent=text};
  const contactMessages=id=>data.messages.filter(m=>m.chat===id);
  function renderFilters(){
    const filters=content.querySelector('#cc-filters');
    filters.innerHTML=[['all','Todos'],['active','En espacios'],...data.workspaces.map(c=>[c.id,c.name])].map(([id,name])=>`<button data-filter="${escape(id)}" class="${filter===id?'active':''}" aria-pressed="${filter===id}">${escape(name)} <small>${id==='all'?data.contacts.length:Object.values(data.members).filter(m=>id==='active'||m.workspaceIds?.includes(id)).length}</small></button>`).join('');
    filters.querySelectorAll('button').forEach(button=>button.onclick=()=>{filter=button.dataset.filter;renderFilters();renderList()});
  }
  function renderList(){
    const needle=norm(search.value);
    visible=data.contacts.filter(c=>{
      const member=data.members[c.id];
      return (filter==='all'||member&&(filter==='active'||member.workspaceIds?.includes(filter)))&&norm(c.name+' '+c.id+' '+contactMessages(c.id).at(-1)?.text).includes(needle);
    }).sort((a,b)=>Number(Boolean(data.members[b.id]))-Number(Boolean(data.members[a.id]))||(contactMessages(b.id).at(-1)?.timestamp||0)-(contactMessages(a.id).at(-1)?.timestamp||0)||String(a.name).localeCompare(String(b.name),'es'));
    content.querySelector('#cc-count').textContent=`${visible.length} contactos`;
    results.innerHTML=visible.slice(0,150).map(c=>{
      const messages=contactMessages(c.id),last=messages.at(-1),member=data.members[c.id];
      return `<button class="contact-result ${selected?.id===c.id?'selected':''}" data-contact="${escape(c.id)}" aria-label="Abrir ${escape(c.name)}" aria-current="${selected?.id===c.id}"><span class="cc-avatar">${escape((c.name||'?').slice(0,2).toUpperCase())}</span><span class="cc-contact-copy"><span class="cc-contact-title"><strong>${escape(c.name||'Sin nombre')}</strong>${member?'<i class="cc-member-dot"></i>':''}</span><small>${escape(last?.text?.slice(0,80)||'Sin mensajes sincronizados')}</small><span class="cc-contact-meta">${escape(member?stages[member.stage]||'En espacio':c.id.endsWith('@g.us')?'Grupo':'Contacto')} · ${escape(date(last?.timestamp))}</span></span></button>`;
    }).join('')||'<div class="cc-no-results">No hay coincidencias.<small>Prueba otro nombre o cambia el filtro.</small></div>';
    if(visible.length>150)results.insertAdjacentHTML('beforeend','<p class="cc-hint">Mostrando 150 contactos. Escribe para afinar la búsqueda.</p>');
    results.querySelectorAll('[data-contact]').forEach(button=>button.onclick=()=>select(data.contacts.find(c=>c.id===button.dataset.contact)));
  }
  async function refresh(){
    const fresh=await api('conversations');if(!live())return;
    const contacts=new Map((fresh.contacts||[]).map(c=>[c.id,c]));
    for(const m of fresh.messages||[])if(!contacts.has(m.chat))contacts.set(m.chat,{id:m.chat,name:m.name});
    data={...fresh,members:fresh.members||{},workspaces:fresh.workspaces||[],contacts:[...contacts.values()]};renderFilters();renderList();
    document.dispatchEvent(new CustomEvent('workspaces-updated',{detail:{workspaces:data.workspaces,members:data.members}}));
    setStatus(`Sincronizado ${new Date().toLocaleTimeString('es-MX')} · ${data.messages.length} mensajes disponibles`);
  }
  async function select(contact){
    if(!contact)return;selected=contact;const selection=++selectionRun;renderList();
    detail.innerHTML='<div class="cc-empty"><span class="cc-spinner"></span><p>Recuperando contexto…</p></div>';
    try{
      const context=await api('context?contactId='+encodeURIComponent(contact.id));if(!live()||selection!==selectionRun)return;
      currentContext=context;renderDetail(context,selection);detail.scrollTop=0;
    }catch(error){if(selection===selectionRun)detail.innerHTML=`<p class="cc-error">${escape(error.message)}</p>`}
  }
  function renderDetail(context,selection){
    const contact=selected,member=context.membership,messages=context.messages||[],summary=context.summary;
    detail.innerHTML=`<header class="cc-profile"><span class="cc-avatar large">${escape((contact.name||'?').slice(0,2).toUpperCase())}</span><div><span class="kicker">FICHA DEL CONTACTO</span><h4>${escape(contact.name)}</h4><p>${escape(contact.id.split('@')[0])} · ${messages.length} mensajes en contexto</p></div><span class="cc-badge">${escape(member?stages[member.stage]:'Sin espacio')}</span></header><div class="cc-membership"><label>Espacios<select id="cc-workspace" multiple size="${Math.min(4,Math.max(2,data.workspaces.length))}">${data.workspaces.map(c=>`<option value="${escape(c.id)}" ${member?.workspaceIds?.includes(c.id)?'selected':''}>${escape(c.name)}</option>`).join('')}</select></label>${member?`<label>Etapa<select id="cc-stage">${Object.entries(stages).map(([id,label])=>`<option value="${id}" ${member.stage===id?'selected':''}>${label}</option>`).join('')}</select></label>`:''}<button class="cc-secondary" id="cc-save-member">${member?'Guardar':'Agregar a espacio'}</button></div><nav class="cc-tabs" aria-label="Secciones de contacto"><button data-tab="overview" class="active">Resumen</button><button data-tab="activity">Conversación <small>${messages.length}</small></button></nav><div data-section="overview"><section class="cc-card"><div class="cc-section-title"><h5>Contexto de Lumen</h5><button id="cc-summary" class="cc-link" ${member?'':'disabled'}>Actualizar resumen</button></div><div id="cc-summary-text" class="cc-prose">${escape(summary?.text||(!member?'Agrega este contacto a un espacio para que Lumen conecte la conversación con su objetivo.':messages.length?'Preparando contexto de esta conversación…':'Aún no hay historial disponible. La ficha se actualizará cuando WhatsApp sincronice mensajes.'))}</div><small id="cc-summary-meta">${summary?escape(`${date(summary.generatedAt)} · ${summary.messageCount} mensajes${summary.revision!==context.revision?' · Hay cambios pendientes de resumir':''}`):'Basado sólo en el historial disponible'}</small></section><section class="cc-card"><div class="cc-section-title"><h5>Elige un flujo</h5><span>Un siguiente paso claro</span></div><div class="cc-flows"><button data-flow="intro"><i>✦</i><strong>Presentar a Lumen</strong><small>${member?.introducedAt?'Presentación registrada · ver o repetir':'Una primera conexión, con identidad clara'}</small></button><button data-flow="followup"><i>↗</i><strong>Dar seguimiento</strong><small>Retomar la conversación con contexto</small></button><button data-flow="reply"><i>↩</i><strong>Preparar respuesta</strong><small>Responder al último intercambio</small></button><button data-flow="meeting"><i>◷</i><strong>Coordinar conversación</strong><small>Proponer el siguiente encuentro</small></button></div><div id="cc-flow-preview" hidden></div></section><section class="cc-card"><h5>Notas de espacio</h5><textarea id="cc-notes" rows="3" maxlength="3000" placeholder="Objetivos, preferencias y acuerdos importantes…">${escape(member?.notes||'')}</textarea><button id="cc-save-notes" class="cc-link" ${member?'':'disabled'}>Guardar notas</button></section></div><div data-section="activity" hidden><div class="cc-timeline">${messages.map(m=>`<article class="${m.fromMe?'outgoing':'incoming'}"><div><b>${m.fromMe?'Tu cuenta':escape(contact.name)}</b><time>${escape(date(m.timestamp))}</time></div><p>${escape(m.text)}</p><small>${m.fromMe?(m.status>=4?'Leído':m.status>=3?'Entregado':'Salida registrada'):'Recibido'} · ${escape(m.id)}</small></article>`).join('')||'<p class="cc-hint">Sin mensajes sincronizados. La ausencia de historial no significa que el chat esté vacío en tu teléfono.</p>'}</div></div>`;
    const active=()=>live()&&selection===selectionRun;
    detail.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{detail.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b===button));detail.querySelectorAll('[data-section]').forEach(section=>section.hidden=section.dataset.section!==button.dataset.tab)});
    const action=async(button,fn)=>{button.disabled=true;try{await fn()}catch(error){setStatus(error.message)}finally{if(button.isConnected)button.disabled=false}};
    const saveMember=async()=>{
      const workspaceIds=[...detail.querySelector('#cc-workspace').selectedOptions].map(option=>option.value);
      if(!workspaceIds.length){if(member){await api('membership','POST',{contactId:contact.id,remove:true});await refresh();if(active())await select(contact);}else setStatus('Elige al menos un espacio para guardar el contacto.');return;}
      const nextStage=detail.querySelector('#cc-stage')?.value||'inactive';
      await api('membership','POST',{contactId:contact.id,workspaceIds,stage:nextStage,notes:detail.querySelector('#cc-notes').value});
      if(member&&nextStage==='active'&&member.stage!=='presented') await api('send','POST',{contactId:contact.id,message:intro,flow:'intro',requestId:crypto.randomUUID()});
      await refresh();if(active())await select(contact);
    };
    detail.querySelector('#cc-save-member').onclick=event=>action(event.target,saveMember);
    detail.querySelector('#cc-save-notes').onclick=event=>action(event.target,saveMember);
    detail.querySelector('#cc-activate')?.addEventListener('click',event=>action(event.target,async()=>{
      await api('membership','POST',{contactId:contact.id,workspaceIds:member.workspaceIds,stage:'inactive',notes:detail.querySelector('#cc-notes').value});
      const result=await api('send','POST',{contactId:contact.id,message:intro,flow:'intro',requestId:crypto.randomUUID()});
      setStatus(`Saludo de Lumen enviado a ${contact.name} · ${result.messageId}`);await refresh();if(active())await select(contact);
    }));
    async function summarize(){
      const button=detail.querySelector('#cc-summary'),target=detail.querySelector('#cc-summary-text');button.disabled=true;
      try{const {summary}=await api('summarize','POST',{contactId:contact.id});if(active()){target.textContent=summary.text;detail.querySelector('#cc-summary-meta').textContent=`${date(summary.generatedAt)} · ${summary.messageCount} mensajes`;}}
      catch(error){if(active()){if(!context.summary)target.textContent=error.message;setStatus(error.message)}}finally{if(active())button.disabled=false}
    }
    detail.querySelector('#cc-summary').onclick=summarize;
    if(member&&messages.length&&summary?.revision!==context.revision)summarize();
    detail.querySelectorAll('[data-flow]').forEach(button=>button.onclick=()=>action(button,async()=>{
      const flow=button.dataset.flow,preview=detail.querySelector('#cc-flow-preview');preview.hidden=false;
      if(!member){preview.innerHTML='<p class="cc-hint">Primero elige un espacio y agrega el contacto.</p>';return;}
      preview.innerHTML='<p class="cc-hint">Lumen está preparando el flujo…</p>';
      let text=flow==='intro'?intro:(await api('draft','POST',{contactId:contact.id,flow})).text;
      if(!active())return;
      const requestId=crypto.randomUUID();
      preview.innerHTML=`<div class="cc-section-title"><h5>${escape(button.querySelector('strong').textContent)}</h5><button class="cc-link" id="cc-close-flow">Cerrar</button></div>${flow==='intro'&&member.introducedAt?`<p class="cc-warning">Ya hay una presentación registrada el ${escape(date(member.introducedAt))}. Este envío la repetirá.</p>`:''}<p class="cc-hint">Para ${escape(contact.name)} · ${escape(context.workspaces?.map(item=>item.name).join(', '))}</p><textarea id="send-message" rows="5" maxlength="1000" aria-label="Mensaje del flujo">${escape(text)}</textarea><div class="cc-send-row"><small>Revisa el mensaje. Tú decides cuándo enviarlo.</small><button id="confirm-send" class="cc-primary">Enviar ${flow==='intro'?'presentación':'mensaje'} ↗</button></div><p id="send-status" role="status"></p>`;
      preview.querySelector('#cc-close-flow').onclick=()=>preview.hidden=true;
      preview.querySelector('#confirm-send').onclick=async()=>{
        const send=preview.querySelector('#confirm-send'),textarea=preview.querySelector('textarea'),feedback=preview.querySelector('#send-status');
        if(!textarea.value.trim()){feedback.textContent='Escribe un mensaje antes de enviarlo.';return;}
        send.disabled=true;textarea.disabled=true;feedback.textContent='Enviando…';
        try{const result=await api('send','POST',{contactId:contact.id,message:textarea.value.trim(),flow,requestId});feedback.textContent=`Envío registrado · ${date(result.sentAt)} · ${result.messageId}`;send.textContent='Enviado ✓';setStatus(`Mensaje enviado a ${contact.name}`);await refresh();}
        catch(error){feedback.textContent=error.message;send.disabled=false;send.textContent='Consultar / reintentar';}
      };
    }));
  }
  search.oninput=()=>{focusIndex=0;renderList()};
  search.onkeydown=event=>{
    if(event.key==='Enter'){event.preventDefault();select(visible[focusIndex]);}
    if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();focusIndex=Math.max(0,Math.min(Math.min(visible.length,150)-1,focusIndex+(event.key==='ArrowDown'?1:-1)));const buttons=results.querySelectorAll('button');buttons.forEach((b,i)=>b.classList.toggle('keyboard-active',i===focusIndex));buttons[focusIndex]?.scrollIntoView({block:'nearest'});}
  };
  content.querySelector('#cc-new-workspace').onclick=()=>{
    const form=content.querySelector('#cc-workspace-form');form.hidden=!form.hidden;
    if(!form.hidden){form.innerHTML='<form class="cc-create"><input name="name" maxlength="80" required placeholder="Nombre de espacio" aria-label="Nombre de espacio"><input name="goal" maxlength="1000" placeholder="¿Qué queremos lograr?" aria-label="Objetivo de espacio"><button class="cc-primary">Crear espacio</button></form>';form.querySelector('form').onsubmit=async event=>{event.preventDefault();const button=form.querySelector('button');button.disabled=true;try{await api('workspaces','POST',Object.fromEntries(new FormData(event.target)));form.hidden=true;await refresh()}catch(error){setStatus(error.message)}finally{button.disabled=false}};form.querySelector('input').focus();}
  };
  try{await refresh();poll=setInterval(()=>{if(!live()){clearInterval(poll);return;}refresh().catch(error=>setStatus(error.message))},8000)}catch(error){setStatus(error.message);results.innerHTML='<p class="cc-hint">No pudimos cargar los contactos. Reabre el centro cuando tu sesión esté conectada.</p>';}
}
