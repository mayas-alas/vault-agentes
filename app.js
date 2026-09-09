const state = { whatsapp: false, calendar: false, assistant: false };

const panels = [...document.querySelectorAll('[data-view-panel]')];
const navItems = [...document.querySelectorAll('[data-view]')];
const toast = document.querySelector('#toast');
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

function navigate(view) {
  panels.forEach((panel) => panel.classList.toggle('active', panel.dataset.viewPanel === view));
  navItems.forEach((item) => item.classList.toggle('active', item.dataset.view === view));
  const current = document.querySelector('.breadcrumbs strong');
  if (current) current.textContent = view === 'onboarding' ? 'Tu contexto' : view === 'connections' ? 'Conexiones' : view === 'assistant' ? 'Tu asistente' : 'Overview';
  window.history.replaceState({}, '', `#${view}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateConnections() {
  const count = Number(state.whatsapp) + Number(state.calendar);
  const counter = document.querySelector('#connected-count');
  if (counter) counter.textContent = count;
  document.querySelectorAll('[data-integration]').forEach((row) => {
    const connected = state[row.dataset.integration];
    const status = row.querySelector('[data-status]');
    const button = row.querySelector('[data-connect-button]');
    if (!status || !button) return;
    status.textContent = connected ? 'Conectado' : 'Sin conectar';
    status.className = `connection-status ${connected ? 'connected' : 'pending'}`;
    button.innerHTML = connected ? 'Administrar <span>↗</span>' : row.dataset.integration === 'whatsapp' ? 'Mostrar QR <span>↗</span>' : 'Autorizar acceso <span>↗</span>';
  });
  document.querySelectorAll('.connection-card').forEach((card) => {
    const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
    const key = title.includes('whatsapp') ? 'whatsapp' : 'calendar';
    const status = card.querySelector('.connection-status');
    const action = card.querySelector('.inline-action');
    if (state[key] && status) { status.textContent = 'Conectado'; status.className = 'connection-status connected'; }
    if (state[key] && action) action.innerHTML = 'Administrar <span>→</span>';
  });
}

function openWhatsAppModal() { document.querySelector('#modal-backdrop').hidden = false; document.body.style.overflow = 'hidden'; }
function closeModal() { document.querySelector('#modal-backdrop').hidden = true; document.body.style.overflow = ''; }

function connectCalendar() {
  const buttons = document.querySelectorAll('[data-action="calendar"]');
  buttons.forEach((button) => { button.disabled = true; button.innerHTML = 'Abriendo Google <span>…</span>'; });
  showToast('Abriendo el flujo seguro de autorización de Google…');
  setTimeout(() => {
    state.calendar = true;
    buttons.forEach((button) => { button.disabled = false; button.innerHTML = 'Administrar <span>→</span>'; });
    updateConnections();
    showToast('Google Calendar quedó conectado a tu workspace.');
  }, 1300);
}

document.addEventListener('click', (event) => {
  const nav = event.target.closest('[data-view]');
  if (nav) { event.preventDefault(); navigate(nav.dataset.view); return; }
  const route = event.target.closest('[data-navigate]');
  if (route) { navigate(route.dataset.navigate); return; }
  const modal = event.target.closest('[data-modal="whatsapp"]');
  if (modal) { openWhatsAppModal(); return; }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'close-modal') closeModal();
  if (action === 'calendar') connectCalendar();
  if (action === 'help') showToast('Tu equipo GNX estará contigo en este siguiente paso.');
  if (action === 'notifications') showToast('No tienes alertas nuevas.');
  if (action === 'assign') { state.assistant = true; showToast('Lumen fue asignado a tu workspace.'); event.target.innerHTML = 'Asignado a mi workspace <span>✓</span>'; event.target.disabled = true; }
  if (action === 'simulate-whatsapp') {
    const status = document.querySelector('#qr-status-text');
    const dot = document.querySelector('.pulse-dot');
    status.textContent = 'Verificando sesión…'; dot.style.background = 'var(--acid)';
    setTimeout(() => { state.whatsapp = true; status.textContent = 'Sesión conectada'; closeModal(); updateConnections(); showToast('WhatsApp quedó conectado a tu workspace.'); }, 1000);
  }
});

document.querySelector('#onboarding-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const company = document.querySelector('#company').value.trim();
  const stateLabel = document.querySelector('#save-state');
  stateLabel.textContent = 'Contexto guardado · ahora';
  stateLabel.style.color = 'var(--mint)';
  showToast(`${company || 'Tu workspace'} ya tiene un punto de partida claro.`);
  setTimeout(() => navigate('connections'), 700);
});

document.querySelector('#modal-backdrop')?.addEventListener('click', (event) => { if (event.target.id === 'modal-backdrop') closeModal(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });
const initialView = window.location.hash.replace('#', '') || 'overview';
navigate(['overview', 'onboarding', 'connections', 'assistant'].includes(initialView) ? initialView : 'overview');
