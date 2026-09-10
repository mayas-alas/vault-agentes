# Vault · Estado de las features

Implementación del ciclo del 10 de septiembre de 2026. Inicio: `npm run dev`, http://127.0.0.1:4176.

| Feature | Entregado | Estado / límite |
|---|---|---|
| Landing en cuatro capítulos | Visión, conexión, contexto y resultado; navegación explícita, scroll interno, navbar persistente, movimiento reducido respetado. | Implementado; visualización Three.js del PoC conservada. |
| Acceso y WhatsApp | Identidad demo, consentimiento y QR ilustrativo, con confirmación de vinculación. | Simulado y rotulado; ningún mensaje real se lee o envía. |
| Clientes y Ctrl/Cmd + K | Búsqueda por nombre, empresa o etiqueta, navegación con flechas/Enter/Esc y acciones contextuales. | Tres clientes ficticios, sin dependencias de CRM. |
| Seguimiento comercial | Contexto original, tono, instrucción adicional, generación local, borrador editable, copiar/escuchar/descargar. | Runtime real; guion de ejemplo explícito cuando el presentador lo elige. |
| Preparación de reunión | Objetivo, contexto, preguntas y próximo paso a partir de conversación y notas confirmadas. | Generación local y guion de presentación. |
| Audio | Captura MediaRecorder, límite de cinco minutos y 10 MB, subida, escucha previa, descarte y transcripción real. | WAV de voz transcrito correctamente por el proxy; permiso de micrófono depende del navegador. |
| Traducción | Traduce texto revisado a español, inglés, francés o portugués; conserva el original usado en cada traducción. | Inglés a español verificado en navegador contra el proxy; errores recuperables, sin traducción ficticia automática. |
| Notas y acuerdos | Confirmar notas por cliente, responsable y fecha opcional, marcar acuerdo completado. | localStorage; no crea eventos ni envía mensajes. |
| Presentación | Tres escenarios, persistencia después de recargar y reinicio con confirmación. | Datos separados por cliente. |

## Runtime y privacidad

Sólo se usa `http://127.0.0.1:31415/v1`. Credencial en `.env.local`, ignorada por Git y fuera de los assets públicos. Configuración de ejemplo sin credenciales en `.env.example`.

- `/api/chat` → `/v1/chat/completions`. Ruta `auto:smart` para borradores y briefings; `auto:fast` para traducciones. Ambas configurables en servidor.
- `/api/audio/transcriptions` → `/v1/audio/transcriptions`. Multipart con `file`, `model` y `response_format=json`.
- `/api/health` comprueba conectividad del catálogo; no garantiza una petición de inferencia futura.
- El audio se mantiene en memoria, nunca se escribe al servidor. Sólo las notas confirmadas se agregan al contexto usado para redactar. Audio original no sobrevive a una recarga.

## Recorrido de presentación

Entrar → simular WhatsApp → buscar Acme con Ctrl + K → preparar/editar seguimiento → guardar nota → confirmar acuerdo. Abrir ◈ para pasar a Northline y probar audio/traducción, o a Casa Sur para preparar una reunión. Usar “Guion de ejemplo” cuando se quiera una presentación determinista; los resultados siempre indican su origen.

Referencia técnica: [FreeLLMAPI REST](https://github.com/tashfeenahmed/freellmapi/blob/main/docs/en/api/01-rest-api.md). El contrato de audio se comprobó también en el OpenAPI de la instalación local.

Verificación del ciclo: recorrido en Edge de búsqueda, seguimiento editable, nota, acuerdo y recuperación tras recarga; briefing de ejemplo; transcripción real de WAV y traducción real; MediaRecorder con entrada de prueba, indicador de nivel y descarte; vista móvil de 390 px sin overflow horizontal ni scroll global de landing; cero errores JavaScript en esos recorridos. Acceso HTTP a `.env.local`: 404. No se probó el micrófono físico del usuario ni una cuenta WhatsApp real.
