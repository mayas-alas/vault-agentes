import{nextIntegrations}from'../domain/vault.js';import{VaultFlowScene}from'./scene.js';

const $=(selector,root=document)=>root.querySelector(selector),clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

const copy={
  1:{title:'01 / Elige una capacidad',text:'Tu identidad ya esta confirmada. Ahora decide que nueva senal puede entrar al vault.',state:'AUTHENTICATED',visual:'Tu vault esta listo',visualCopy:'Elige una senal para ampliar el campo de accion.'},
  2:{title:'02 / Define el alcance',text:'Cada cuenta entra con un proposito claro. El contexto sigue siendo tuyo.',state:'SELECT SIGNAL',visual:'Una senal, un proposito',visualCopy:'Elige el permiso que tenga sentido para tu siguiente movimiento.'},
  3:{title:'03 / Confirma el handoff',text:'El proveedor valida la identidad y devuelve solo el acceso que acabas de aprobar.',state:'SECURE HANDOFF',visual:'El permiso vuelve al vault',visualCopy:'La ventana OAuth termina en el proveedor, no en este navegador.'},
  4:{title:'04 / Expande tu campo',text:'La cuenta ya forma parte del sistema. Puedes revocar el acceso cuando quieras.',state:'VAULT EXPANDED',visual:'Nueva senal recibida',visualCopy:'Lumen ya puede proponer un flujo alrededor de esta capacidad.'}
};

export function initAccountFlow(){
  const root=$('#account-flow');if(!root)return;
  const canvas=$('#flow-canvas'),scene=new VaultFlowScene(canvas,nextIntegrations.length),grid=$('#flow-provider-grid'),authPanel=$('#flow-auth-panel');
  let selected=null,currentStep=1,authBusy=false,dragging=false,lastPoint=null;
  const connected=new Set();
  try{JSON.parse(localStorage.getItem('gnx-vault-next-connections')||'[]').forEach(id=>connected.add(id))}catch{}
  const persist=()=>localStorage.setItem('gnx-vault-next-connections',JSON.stringify([...connected]));
  const selectedProvider=()=>nextIntegrations.find(provider=>provider.id===selected);

  function renderProviders(){grid.innerHTML=nextIntegrations.map(provider=>{const isConnected=connected.has(provider.id);return`<button type="button" class="flow-provider-card ${isConnected?'connected':''}" style="--provider-color:${provider.color}" data-flow-provider="${provider.id}" aria-pressed="${selected===provider.id}"><span class="flow-provider-top"><span class="flow-provider-icon">${provider.mark}</span><span class="flow-provider-tag">${provider.tag}</span></span><strong>${provider.name}</strong><small>${provider.copy}</small><span class="flow-provider-action">${isConnected?'Conectada · administrar':'Autorizar acceso ↗'}</span></button>`}).join('')}
  function setStep(step){currentStep=step;const state=copy[step];$('#flow-step-title').textContent=state.title;$('#flow-step-copy').textContent=state.text;$('#flow-step-count').textContent=`0${step}—04`;$('#flow-visual-state').textContent=state.state;$('#flow-visual-title').textContent=state.visual;$('#flow-visual-copy').textContent=selectedProvider()?.reason||state.visualCopy;$('#flow-progress-bar').style.width=`${step*25}%`;scene.setStep(selectedProvider()?nextIntegrations.findIndex(provider=>provider.id===selected)+1:-1);root.dataset.flowStep=step}
  function showAuth(provider){authPanel.hidden=false;authPanel.innerHTML=`<strong>Conectar ${provider.name}.</strong><p>Se abrira una ventana OAuth simulada. GNX recibe un permiso limitado y revocable; ningun secreto se guarda en esta vista.</p><div class="flow-auth-actions"><span class="flow-auth-status" id="flow-auth-status">READY FOR CONSENT</span><button type="button" class="primary" data-flow-authorize>Continuar con OAuth ↗</button></div>`}
  function selectProvider(id){if(authBusy)return;selected=id;const provider=selectedProvider();renderProviders();showAuth(provider);setStep(2);authPanel.scrollIntoView({behavior:'smooth',block:'nearest'})}
  function resetSelection(){if(authBusy)return;selected=null;authPanel.hidden=true;renderProviders();setStep(1)}
  async function authorize(){const provider=selectedProvider();if(!provider||authBusy)return;authBusy=true;setStep(3);const action=$('[data-flow-authorize]',authPanel),status=$('#flow-auth-status');action.disabled=true;action.textContent='Abriendo handoff...';status.textContent='REDIRECTING TO PROVIDER';await new Promise(resolve=>setTimeout(resolve,700));status.textContent='VERIFYING LIMITED SCOPE';await new Promise(resolve=>setTimeout(resolve,800));connected.add(provider.id);persist();renderProviders();setStep(4);authPanel.innerHTML=`<strong>${provider.name} ya esta conectada.</strong><p>El vault recibio una senal de prueba y la dejo lista para un flujo premium. El permiso permanece bajo tu control.</p><div class="flow-auth-actions"><span class="flow-auth-status">OAUTH VERIFIED · DEMO</span><button type="button" data-flow-reset>Conectar otra ↗</button></div>`;authBusy=false}
  function scrollProgress(){const rect=root.getBoundingClientRect(),range=Math.max(1,root.offsetHeight-innerHeight),value=clamp((scrollY-(scrollY+rect.top-root.offsetTop))/range,0,1);if(!authBusy&&!selected){const step=value<.22?1:value<.5?2:value<.78?3:4;if(step!==currentStep)setStep(step)}}
  grid.addEventListener('click',event=>{const card=event.target.closest('[data-flow-provider]');if(card)selectProvider(card.dataset.flowProvider)});
  authPanel.addEventListener('click',event=>{if(event.target.closest('[data-flow-authorize]'))authorize();if(event.target.closest('[data-flow-reset]'))resetSelection()});
  document.addEventListener('click',event=>{if(event.target.closest('[data-flow-trigger]')){root.scrollIntoView({behavior:'smooth'});setStep(1)}});
  addEventListener('scroll',scrollProgress,{passive:true});
  canvas.addEventListener('pointerdown',event=>{dragging=true;lastPoint={x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);canvas.classList.add('dragging')});canvas.addEventListener('pointermove',event=>{if(!dragging)return;scene.drag(event.clientX-lastPoint.x,event.clientY-lastPoint.y);lastPoint={x:event.clientX,y:event.clientY}});const stopDrag=event=>{dragging=false;lastPoint=null;canvas.classList.remove('dragging');if(event.pointerId!==undefined&&canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId)};canvas.addEventListener('pointerup',stopDrag);canvas.addEventListener('pointercancel',stopDrag);canvas.addEventListener('pointerleave',event=>{if(dragging)stopDrag(event)});
  root.querySelectorAll('.reveal').forEach(element=>element.classList.add('visible'));renderProviders();setStep(1);if(location.hash==='#account-flow')setTimeout(()=>root.scrollIntoView({behavior:'auto'}),80);
}
