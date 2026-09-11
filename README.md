# GNX Vault · WhatsApp login + Lumen

MVP local de GNX Vault. El usuario entra escaneando un QR real de WhatsApp,
abre una sesión aislada por navegador y opera Lumen con voz o con los paneles.

## Ejecutar

El servidor carga primero `.env.local` y después `.env`:

```env
OPENAI_BASE_URL=http://127.0.0.1:31415/v1
OPENAI_API_KEY=...
OPENAI_MODEL=auto
```

```powershell
npm install
npm run dev
```

Abrir `http://localhost:4175`. La llave permanece en el servidor y los archivos
de entorno están excluidos de Git. `GET /api/health` comprueba que el runtime
responda; no considera la IA online solo porque exista una llave.

## Flujo implementado

- `Entrar con WhatsApp` genera un QR real mediante Baileys dentro del contenedor
  `gnx-hermes` en WSL.
- La app solo abre después de que WhatsApp confirme la conexión.
- Cada cookie HttpOnly firmada apunta a credenciales, contactos e historial
  separados en `/opt/data/vault-clients/<id>/`.
- `Ctrl+K` busca contactos, muestra hasta seis mensajes recientes y prepara la presentación editable de Lumen.
- Lumen reconoce órdenes como `mándale a Ana el mensaje ...`; siempre prepara
  el contenido y exige confirmación explícita antes de enviarlo desde la misma
  sesión de WhatsApp vinculada. El bridge conserva el identificador exacto
  sincronizado por WhatsApp y exige un ID real de mensaje.
- `Cerrar sesión` intenta desvincular WhatsApp, borra la persistencia local,
  revoca la cookie y elimina el directorio de esa identidad.
- Email guarda temporalmente una dirección y declara la verificación pendiente;
  no simula que se envió una confirmación.
- El micrófono usa `MediaRecorder`, envía audio real a
  `/v1/audio/transcriptions` y utiliza SpeechRecognition del navegador como
  respaldo cuando está disponible. No genera transcripciones ficticias.
- Lumen usa `/v1/chat/completions`; si el runtime falla, la UI lo reporta y no
  inventa una respuesta local.

El historial visible depende de lo que WhatsApp sincronice al dispositivo
vinculado y se limita a texto/captions en este MVP. Es una arquitectura local:
para producción faltan un servicio administrado de sesiones, cifrado por tenant,
control de acceso remoto y políticas de retención.

## Validación

```powershell
npm run check
npm run test:ui
npm run test:qr
```

`test:ui` usa contratos controlados y no envía mensajes. `test:qr` arranca una
sesión real y verifica que aparezca un QR, pero tampoco lo escanea ni envía nada.

Referencias: [Hermes WhatsApp](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/whatsapp)
y [Baileys](https://github.com/WhiskeySockets/Baileys/blob/master/README.md).
