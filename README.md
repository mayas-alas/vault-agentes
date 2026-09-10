# Vault · Demo de negocio

Demo en HTML, CSS y JavaScript con el runtime local en `http://127.0.0.1:31415/v1`.

## Abrir

`npm run dev` → http://127.0.0.1:4176

La configuración privada vive en `.env.local` (ignorada por Git). Usa `.env.example` como referencia. El servidor sólo escucha en loopback y sólo sirve assets públicos; nunca entrega archivos de configuración. Las peticiones de IA y audio usan exclusivamente el proxy local.

## Recorrer

1. Explora los cuatro capítulos con la navegación superior. Cada sección tiene su propio scroll.
2. Abre el espacio, continúa con la identidad de demo y simula la vinculación de WhatsApp.
3. Busca con Ctrl/Cmd + K o elige uno de los tres clientes.
4. Prepara un seguimiento, un briefing o una nota de voz. Los resultados del runtime y los guiones de ejemplo están identificados.
5. Edita, copia, descarga o guarda la propuesta como nota. Confirma un acuerdo con responsable y fecha opcional.

El botón ◈ abre tres escenarios. Reiniciar solicita confirmación porque elimina las notas, borradores y acuerdos locales de la demo. Los datos están separados por cliente y se recuperan después de recargar.

## Audio

Graba hasta cinco minutos o sube WAV, WebM, OGG, MP3 o M4A (máximo 10 MB). Escucha antes de pulsar **Transcribir**. El servidor envía el archivo a `/v1/audio/transcriptions` sin conservarlo. Revisa el texto antes de guardarlo o traducirlo. La traducción usa `/v1/chat/completions`; el original permanece editable. La reproducción del texto usa las voces disponibles en el navegador.

## Límites explícitos

Login, QR y conversaciones son simulados. El runtime y la transcripción usan el servicio real configurado. No se envían mensajes de WhatsApp ni se crean eventos externos. Audio grabado permanece sólo en memoria; notas confirmadas y borradores se guardan en este navegador. La calidad y disponibilidad de la generación dependen del pool del runtime.

## Archivos activos

`src/main.js`: interacciones y estado; `src/domain/clients.js`: escenarios; `src/ui/scene.js`: visualización; `experience.css`: interfaz; `server.js`: proxy local y servidor de desarrollo.

`npm run check` comprueba sintaxis. La referencia del proxy es [FreeLLMAPI REST](https://github.com/tashfeenahmed/freellmapi/blob/main/docs/en/api/01-rest-api.md).
