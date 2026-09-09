# GNX Vault presentation layer

Landing interactiva para presentar el vault de GNX Labs: onboarding inteligente, conexiones, contexto persistente y colaboración por voz con un agente.

## Desarrollo

Carga el `.env` privado del repositorio principal y abre `http://localhost:4175`:

```powershell
$env:VAULT_ENV_FILE='C:\Users\mayas\orca\vault-agentes\.env'
npm run dev
```

El servidor recarga el navegador al cambiar HTML, CSS o JavaScript. `GET /api/health` indica si Terra está configurada sin revelar la llave.

## Estructura

```text
src/domain/       Modelo y catálogo de capacidades
src/application/  Casos de uso y estado de la experiencia
src/adapters/     API mock y capacidades del navegador
src/ui/           Escenas Three.js
src/main.js       Composición e interacciones de la página
server.js         Servidor dev, live reload y frontera OpenAI
```

El frontend nunca recibe la API key. `server.js` usa Responses API con `gpt-5.6-terra`, razonamiento `medium`, historial corto y `store: false`. Si la llave no está disponible, Lumen conserva el fallback local de la demo.

## Entrada al vault

`Entrar al vault` simula identidad OAuth, consentimiento y callback antes de abrir un workspace inmersivo independiente de la landing. La experiencia permite conversar con Lumen y probar conexiones adicionales; solo se guardan IDs de demo, nunca tokens.

La sesión se minimiza como una burbuja arrastrable. Active Thread funciona con flujos guiados y respuestas rápidas, sin teclado. El control de Lumen graba audio con `MediaRecorder`, lo transcribe en el servidor con `gpt-4o-mini-transcribe` y envía el texto resultante a Terra; conserva reconocimiento/fallback local si el navegador no permite grabar.

## Funnel

El host público solo entrega la interfaz por defecto. Las rutas que consumen OpenAI (`/api/chat` y `/api/transcribe`) quedan deshabilitadas desde Funnel para evitar exponer la llave a uso público. Puedes habilitarlo conscientemente solo con `ALLOW_PUBLIC_AI=true` en el entorno del servidor.

```powershell
tailscale funnel --bg --yes 4175
tailscale funnel status
```
