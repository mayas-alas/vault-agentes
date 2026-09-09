# GNX Vault — propuesta de capa de presentación

## Resumen

GNX Vault será el punto de entrada que convierte contexto de cliente en una operación conectada. El prototipo presenta una experiencia breve y clara: el cliente comparte su contexto en onboarding, conecta WhatsApp y Google Calendar, y recibe una propuesta de agente asistente. La app es únicamente frontend estático en HTML, CSS y JavaScript vanilla; consume un servidor externo de integraciones e inteligencia.

El repositorio no contenía archivos Markdown ni servicios existentes para resumir. La demo queda en modo mock para que el cliente pueda recorrer el flujo sin credenciales reales.

## Flujo de cliente

1. **Onboarding:** captura nombre del proyecto, prioridad operativa e insight personal.
2. **Overview:** muestra el siguiente paso, avance del onboarding, estado de conexiones e insight del día.
3. **Conexiones:** presenta WhatsApp y Google Calendar como dos capacidades independientes con sus estados.
4. **WhatsApp:** el frontend solicita al servidor el estado y el QR de Hermes Agent; el cliente escanea y la UI refleja la sesión.
5. **Google Calendar:** el frontend inicia un flujo OAuth del servidor y luego muestra la cuenta conectada, permisos y estado.
6. **Agent match:** se muestra el agente sugerido, por qué encaja y la acción para asignarlo al workspace.

## Pantallas del prototipo

- `Overview`: resumen operativo para una primera reunión con el cliente.
- `Tu contexto`: formulario breve con preview del contexto y guardado simulado.
- `Conexiones`: tarjetas para WhatsApp y Calendar, estados `Sin conectar`, `Conectando`, `Conectado` y error.
- `Tu asistente`: propuesta de agente, habilidades, razones de recomendación y primer ejemplo de ayuda.
- Modal de WhatsApp: QR visual, espera de escaneo y confirmación de conexión.

## Contrato de consumo sugerido

El frontend puede centralizar las llamadas en un cliente futuro `api.js`:

```js
GET  /api/v1/workspaces/:id/overview
POST /api/v1/workspaces/:id/onboarding
GET  /api/v1/integrations/whatsapp/session
POST /api/v1/integrations/whatsapp/session/refresh
GET  /api/v1/integrations/google/start
GET  /api/v1/integrations/google/status
POST /api/v1/agents/match
POST /api/v1/agents/:id/assign
```

Respuestas mínimas:

```json
{ "status": "pending|connecting|connected|error", "message": "...", "updatedAt": "..." }
```

Para QR, el backend debe entregar `qrDataUrl` o una URL temporal y `expiresAt`; nunca se debe persistir el QR en el frontend.

## Seguridad y límites

- El `client ID` público de Google puede vivir en configuración de entorno del servidor o en un bootstrap público; el `client secret`, refresh token y claves de Hermes deben permanecer en el backend.
- Preferir OAuth iniciado en el servidor con `state`, PKCE cuando aplique y redirect URI registrada.
- La sesión del frontend debe recibir cookie segura o token de corta duración y no guardar secretos en `localStorage`.
- Este proyecto no levanta Hermes, Google Calendar, agentes, colas ni servicios terceros.
- La lógica de inteligencia, matching real, automatizaciones y envío de mensajes viven en el servidor externo.

## Dirección visual

La propuesta usa un vault oscuro, silencioso y editorial: verde menta para señal y progreso, amarillo ácido para acciones, tipografía monoespaciada para estados técnicos y órbitas para representar conexiones. La jerarquía está pensada para que un cliente entienda primero el valor y después la infraestructura.

## Criterios de aceptación

- La demo se abre como archivo estático y funciona sin build step.
- Un cliente puede recorrer Overview, onboarding, conexiones y agente asistente.
- El onboarding guarda su estado visual y enlaza con Conexiones.
- El modal de WhatsApp muestra el punto real de integración del QR y tiene estado simulado de conexión.
- Google Calendar muestra un punto de entrada OAuth y estado simulado de conexión.
- La app es responsive y tiene estados de vacío, pendiente, conectado y feedback de acción.
- No hay credenciales reales, backend local ni llamadas a terceros desde esta demo.
