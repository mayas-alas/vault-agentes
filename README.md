# GNX Vault presentation layer

Landing interactiva para presentar el vault de GNX Labs: onboarding inteligente, conexiones, contexto persistente y colaboración por voz con un agente.

## Ejecutar

Sirve la carpeta con cualquier servidor estático y abre `http://localhost:4173`:

```powershell
python -m http.server 4173
```

## Estructura

```text
src/domain/       Modelo y catálogo de capacidades
src/application/  Casos de uso y estado de la experiencia
src/adapters/     API mock y capacidades del navegador
src/ui/           Escenas Three.js
src/main.js       Composición e interacciones de la página
```

No hay backend local. `MockVaultAdapter` simula los contratos del servidor y persiste únicamente contexto de demostración en `localStorage`. Las API keys nunca se persisten ni salen del formulario mock.

## Flujo post-auth

Desde `Live agent`, `Conectar mas cuentas` lleva a una escena sticky y scroll-driven. El handoff simula OAuth para cuatro capacidades de siguiente release: Hugging Face, Instagram, Notion y Slack. La escena Three.js responde al scroll y al arrastre; la demo solo persiste IDs de conexiones aprobadas, nunca tokens ni secretos.
