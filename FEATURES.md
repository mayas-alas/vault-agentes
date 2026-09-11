# GNX Vault · funcionalidades actuales

Este documento describe el MVP funcional de GNX Vault con Lumen, sus flujos de usuario, el modelo de datos y las integraciones disponibles.

## 1. Experiencia principal

- Entrada al Vault con sesión local de WhatsApp.
- Presencia visual de Lumen con estado de conexión, actividad y micrófono.
- Hilo activo orientado a audio: el usuario habla manteniendo pulsado el micrófono o activa escucha continua.
- Transcripción de audio mediante `/api/transcribe`.
- Las respuestas completas se muestran en el hilo; el gadget visual sólo muestra estados breves y no expone contexto interno.
- Panel de señales, cuentas conectadas, preparación y siguiente resultado.
- Flujos guiados para preparar una decisión o definir un resultado mediante opciones rápidas.

## 2. Centro Ctrl+K

El centro de contactos se abre con Ctrl+K o desde “Espacios y contactos”.

- Búsqueda por nombre, número o contenido del último mensaje.
- Lista inicial enfocada en contactos activos, evitando mostrar todos los contactos sin contexto.
- Filtro “Disponibles” para incorporar contactos uno por uno.
- Filtros por espacio y contador de contactos.
- Navegación por teclado: flechas, Enter, Tab y Escape.
- Diseño adaptable para escritorio y móvil.
- Panel de ficha con identidad, etapa, espacios, resumen, notas e historial.
- El panel de detalle vuelve al inicio al cambiar de contacto para evitar mostrar una sección desplazada anterior.

## 3. Espacios y etapas

Los contactos pueden pertenecer a varios espacios simultáneamente.

Etapas disponibles:

- `inactive`: contacto incorporado pero aún no activado.
- `active`: listo para recibir el saludo de Lumen.
- `presented`: saludo enviado y confirmado por WhatsApp.
- `engaged`: conversación en curso.
- `done`: recorrido completado.

Los espacios contienen nombre, objetivo y fecha de creación. La pertenencia conserva notas, etapa, fecha de presentación e identificador del mensaje enviado.

## 4. Activación y saludo automático

Hay dos formas de activar un contacto:

1. Abrir un contacto disponible y pulsar “Activar y enviar saludo de Lumen”.
2. Hacer clic derecho sobre un contacto y elegir “Activar y saludar”.

La activación:

1. Agrega el contacto al primer espacio disponible.
2. Marca temporalmente la etapa `active`.
3. Envía el mensaje de presentación de Lumen.
4. Cambia a `presented` sólo cuando WhatsApp devuelve una confirmación real.
5. Si falla, conserva el contacto para reintentar sin perder la selección.

## 5. Menú contextual de contactos

El clic derecho sobre un contacto dentro de Ctrl+K abre un menú contextual con:

- Abrir ficha.
- Activar y saludar.
- Reenviar saludo de Lumen para contactos ya incorporados.
- Unir con otro contacto.

El menú se posiciona dentro del modal, se cierra al hacer clic fuera y responde a Escape sin cerrar todo el centro.

## 6. Historial y contexto

- La conversación muestra mensajes entrantes y salientes, estado de entrega, fecha e identificador.
- Se conserva el historial reciente sincronizado con WhatsApp.
- Lumen recibe contactos, pertenencias, espacios y mensajes como datos de contexto, no como instrucciones.
- El resumen se genera bajo demanda y se guarda con una revisión hash.
- Si llegan mensajes nuevos, el resumen se marca como pendiente de actualizar.
- La ficha diferencia presentación enviada, respuesta recibida y próximos pasos.

## 7. Flujos de conversación

Desde una ficha incorporada se pueden iniciar estos flujos:

- Presentar a Lumen.
- Dar seguimiento.
- Preparar respuesta.
- Coordinar conversación.

Los flujos de redacción generan un borrador basado en el historial. El envío sólo ocurre después de una acción explícita del usuario, excepto la activación inicial, que dispara automáticamente el saludo definido.

## 8. Unión de contactos duplicados

WhatsApp puede entregar dos identificadores para la misma persona. La ficha incluye “Unir este contacto con otro”.

La unión:

- Reasigna los mensajes al contacto principal.
- Persiste un alias para futuros mensajes.
- Elimina el duplicado de la lista.
- Combina espacios y notas.
- Invalida los resúmenes para regenerarlos con el historial completo.
- También se puede iniciar desde el menú de clic derecho.

## 9. Integración WhatsApp

- Sesión aislada por identidad local del navegador.
- QR de vinculación y estado de conexión.
- Sincronización de contactos e historial reciente.
- Envío real mediante el worker Hermes ejecutado en WSL/Podman.
- Confirmación de envío con identificador de mensaje.
- Idempotencia por identificador de solicitud para evitar duplicados.
- Control de sesiones, logout y creación de una sesión local nueva.

## 10. Runtime de Lumen

- Base configurable mediante `OPENAI_BASE_URL`.
- Valor local previsto: `http://127.0.0.1:31415/v1`.
- Chat, resúmenes, borradores y panorama usan el mismo runtime.
- Las respuestas se limitan y se muestran en español.
- El sistema evita afirmar acciones no confirmadas y trata el contenido del chat como datos no confiables.

## 11. Endpoints principales

Todos los endpoints de WhatsApp viven bajo `/api/whatsapp/client/`:

| Endpoint | Función |
| --- | --- |
| `session` | Iniciar o consultar conexión |
| `conversations` | Obtener mensajes, contactos, espacios y pertenencias |
| `workspaces` | Consultar o crear espacios |
| `membership` | Agregar, actualizar o retirar un contacto |
| `context` | Obtener ficha contextual de un contacto |
| `summarize` | Generar o recuperar resumen |
| `draft` | Crear borrador para un flujo |
| `brief` | Panorama general de los contactos incorporados |
| `send` | Enviar un mensaje y confirmar resultado |
| `merge` | Unir identidades e historiales duplicados |
| `logout` | Revocar y cerrar la sesión |
| `new` | Crear una identidad local nueva |

## 12. Persistencia y compatibilidad

- Estado local por identidad de navegador.
- Persistencia de espacios, miembros, resúmenes, envíos y exclusiones.
- Migración automática de datos históricos al formato actual de espacios y pertenencias.
- Almacenamiento temporal atómico mediante archivos `.tmp` y rename.
- Datos de WhatsApp persistidos por el worker en el volumen local de Hermes.

## 13. Seguridad y límites

- Acceso de API limitado a localhost.
- Cookie de sesión firmada y revocable.
- Límite de tamaño para solicitudes y mensajes.
- Validación de contactos pertenecientes a la sesión activa.
- No se envían mensajes sin sesión conectada ni confirmación del worker.
- No se interpreta texto de chats como instrucciones del sistema.

## 14. Verificación actual

Comandos ejecutados con éxito:

```text
npm run check
npm run test:workspaces
npm run test:ui
```

Las pruebas cubren persistencia, aislamiento de identidades, resumen fundamentado, flujo de envío, navegación por teclado, Escape, diseño móvil y logout. Las pruebas UI no envían mensajes reales.

## 15. Siguientes mejoras recomendadas

- Prueba automatizada específica del clic derecho y activación.
- Selector de espacio de destino cuando existan varios espacios.
- Vista de auditoría de activaciones, reintentos y uniones.
- Sincronización incremental superior a los últimos mensajes disponibles.
- Resolución automática de identidades cuando WhatsApp entregue señales suficientes para asociarlas con alta confianza.
