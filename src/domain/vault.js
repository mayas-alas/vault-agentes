export const integrations=[
{id:'whatsapp',name:'WhatsApp',mark:'WA',color:'#9af0b6',copy:'Conversaciones, respuestas y flujos definidos vía Hermes Agent.',mode:'qr',action:'Vincular con QR'},
{id:'calendar',name:'Google Calendar',mark:'GC',color:'#90c9ff',copy:'Disponibilidad, eventos y acuerdos que sí llegan a la agenda.',mode:'oauth',action:'Autorizar calendario'},
{id:'github',name:'GitHub',mark:'GH',color:'#d5d9d7',copy:'Repositorios, issues y señales reales del trabajo en curso.',mode:'oauth',action:'Conectar GitHub'},
{id:'tailscale',name:'Tailscale',mark:'TS',color:'#c0aeff',copy:'Acceso privado a servicios y agentes que viven en tu red.',mode:'network',action:'Vincular tailnet'},
{id:'runtime',name:'AI Runtime',mark:'AI',color:'#d8ff8f',copy:'OpenAI o tu API local. Tú eliges dónde vive la inteligencia.',mode:'secret',action:'Elegir runtime'}];
export const questions=[
{title:'¿Qué estás construyendo ahora?',copy:'Dímelo como se lo contarías a alguien de confianza.',choices:['Un nuevo producto','Una operación más ligera','Un equipo con agentes'],key:'intent'},
{title:'¿Qué debería moverse primero?',copy:'Elegiremos un resultado visible para empezar.',choices:['Responder más rápido','Cuidar mi agenda','Coordinar al equipo'],key:'priority'},
{title:'¿Cómo quieres colaborar?',copy:'Tu agente adaptará su ritmo y su forma de proponer.',choices:['Directo y breve','Explorar conmigo','Con autonomía'],key:'style'}];
export const initialState={connections:{},profile:{},objectives:['Conectar calendario','Definir primer flujo'],agreements:[]};
