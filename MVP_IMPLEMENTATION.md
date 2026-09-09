# Vault MVP · implementación verificable

## Resultado

Una demo privada que convierte conversación en acción: OAuth simulado → workspace inmersivo → voz/transcript → búsqueda de clientes → recomendación de Lumen.

## Slice implementado

1. **Runtime local:** Vault escucha sólo en `127.0.0.1:4175` y consume FreeLLMAPI `v0.9.8` en `127.0.0.1:31415/v1`.
2. **Voz:** `MediaRecorder` → `/api/transcribe` → FreeLLMAPI STT → transcript visible → `/api/chat` → respuesta; `/api/speech` intenta TTS remoto y cae a voz del navegador si el proveedor no responde.
3. **CRM signal view:** `Ctrl+K` abre 30 clientes demo derivados de análisis WhatsApp, con búsqueda, riesgo, oportunidad, resumen y siguiente acción.
4. **AI action:** elegir un cliente envía sus señales a Lumen para producir respuesta y seguimiento dentro del hilo activo.

## Contratos

- `POST /api/chat` `{ message, history? }` → `{ text, model, responseId }`
- `POST /api/transcribe` `{ audio: base64, mime }` → `{ text, model }`
- `POST /api/speech` `{ text }` → bytes de audio
- `GET /api/health` → estado de gateway, modelos de texto/audio y exposición pública

Las llaves permanecen en `.env`; ningún secreto llega al navegador. WhatsApp y OAuth son contratos demo hasta conectar Hermes/callback reales.

## Siguiente corte de producto

Reemplazar `demoClients` por un endpoint de Hermes que entregue contactos normalizados, evidencias y consentimiento; persistir acciones CRM; añadir auditoría por señal y evaluación de calidad de respuestas. El diseño actual conserva esos límites sin introducir un framework ni una base local prematura.

