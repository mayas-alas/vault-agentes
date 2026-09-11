# Plan de contexto para campañas y conversaciones

Este documento fija el comportamiento que debe conservar el MVP y el orden para cerrar los dos problemas visibles en la ficha de Albracom:

1. La conversación debe mostrar todos los mensajes que WhatsApp haya sincronizado, incluida la respuesta del usuario.
2. Un contacto puede pertenecer a varias campañas sin duplicar el contacto ni perder el historial.

## Diagnóstico

La ficha actual consulta `client.messages` por una igualdad directa de `chat`. WhatsApp puede representar a la misma persona con más de un JID, por ejemplo `521...@s.whatsapp.net` y `...@lid`. Una igualdad directa separa esos mensajes y hace que la respuesta parezca ausente. El mensaje enviado a Albracom aparece porque usa el JID de envío; una respuesta recibida con el JID alterno puede quedar en otra conversación visual.

La pertenencia de campaña actual tiene la forma `members[contactId] = { campaignId, stage, notes }`. Eso impide representar dos campañas para el mismo contacto y hace que el filtro de campaña sea ambiguo.

## Modelo objetivo

### Identidad canónica

Crear un índice por identidad:

```text
identities[canonicalContactId] = {
  ids: [jid, lid, ...],
  name,
  phone,
  aliases
}
```

La identidad canónica debe priorizar `remoteJidAlt`, `lid`, el número normalizado y después el JID original. Nunca se debe usar el nombre como clave. Cada mensaje conserva su `chat`, `chatAlt` e `id`, pero la ficha consulta por `canonicalContactId`.

Al recibir `contacts.upsert`, `messaging-history.set`, `messages.upsert` o `messages.update`, se actualiza el índice y se reagrupan los mensajes. La deduplicación usa `messageId + todos los JID conocidos`; nunca el texto, porque dos mensajes iguales pueden ser legítimos.

### Pertenencia a campañas

Cambiar a:

```text
members[canonicalContactId] = {
  campaigns: {
    [campaignId]: {
      stage,
      notes,
      introducedAt,
      lastSummaryRevision,
      updatedAt
    }
  }
}
```

La pantalla debe mostrar una tarjeta por contacto y dentro de ella chips de todas sus campañas. El filtro de campaña devuelve el contacto si contiene esa campaña; nunca debe duplicar la tarjeta por cada campaña.

Las acciones de flujo reciben siempre `canonicalContactId` y `campaignId`. El mensaje enviado se registra con ambos valores, `messageId`, `requestId`, estado de WhatsApp y fecha. Reintentar el mismo `requestId` debe devolver el resultado guardado y no enviar otro mensaje.

## Historial siempre actualizado

- Mantener un `messages.revision` monotónico en el worker y enviarlo en cada snapshot.
- El command center hace polling corto mientras está abierto y escucha un evento de actualización para refrescar sólo la ficha seleccionada.
- Al cambiar de ficha, cancelar la solicitud anterior para evitar que una respuesta vieja pinte el contacto equivocado.
- Mostrar `Recibido`, `Salida registrada`, `Entregado` o `Leído` según el estado real de Baileys. Nunca convertir “salida registrada” en “respondido”.
- Si no hay respuesta, mostrar explícitamente `Sin respuesta sincronizada todavía` con la hora de la última actualización.
- Si WhatsApp aún no sincronizó el historial, distinguir `No sincronizado` de `Sin mensajes`.

## Resumen útil para una persona

El resumen se genera por par `canonicalContactId + campaignId`, con una revisión hash del historial, notas y objetivo de campaña. Debe contener:

- contexto y objetivo de la campaña;
- señales recibidas, citando IDs y fechas;
- mensajes enviados y su estado real;
- pendientes y preguntas abiertas;
- siguiente acción propuesta, siempre marcada como propuesta.

Una presentación de Lumen sólo prueba que el mensaje salió. No prueba lectura, respuesta, interés ni incorporación efectiva a una campaña.

## Flujos visibles

La ficha debe abrirse desde Ctrl+K sin una pantalla intermedia de confirmación genérica. Los flujos son:

- Presentar a Lumen: texto inicial editable, etiqueta de identidad y estado `presented` después del acuse real.
- Dar seguimiento: borrador basado en el último intercambio.
- Preparar respuesta: respuesta al último mensaje recibido.
- Coordinar conversación: propuesta de disponibilidad sin inventar una cita.

Cada flujo muestra destinatario, campaña, contexto usado, textarea editable, botón de envío, request ID y estado confirmado por WhatsApp.

## Criterios de aceptación

- El historial de Albracom muestra el mensaje de Lumen y cualquier respuesta recibida aunque llegue con otro JID.
- Un contacto puede pertenecer a dos campañas y aparecer una sola vez en `Todos`.
- Cambiar de campaña conserva notas e historial, pero genera resúmenes independientes.
- Una actualización entrante aparece en la ficha abierta sin recargar el navegador.
- Los estados de entrega no se confunden con respuestas.
- Ctrl+K funciona con búsqueda, flechas, Enter, Escape y foco accesible.
- El runtime usado por resúmenes y borradores es `OPENAI_BASE_URL=http://127.0.0.1:31415/v1`.
- Las pruebas cubren JID alterno, multi-campaña, actualización en vivo, idempotencia de envío y diseño móvil.

## Orden de implementación

1. Canonicalizar JIDs y migrar mensajes existentes.
2. Migrar `campaignId` a `campaigns[]` con compatibilidad de lectura.
3. Exponer revisiones y estados del worker.
4. Refrescar una ficha sin perder selección ni scroll.
5. Añadir pruebas de regresión para Albracom y un JID `@lid` equivalente.
6. Revalidar en una sesión real y publicar el commit.
