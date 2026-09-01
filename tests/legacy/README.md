# Suite anterior (excluida de la ejecución)

Estos tests **no se ejecutan**: `jest.config.js` los excluye mediante
`testPathIgnorePatterns`. Se conservan a propósito.

Al retirarse estaban **todos en verde**: 37 pruebas en 7 ficheros, medidas con
`pnpm test` sobre `4596add` (1/09/2026). El desglose por fichero:

| Fichero | Pruebas |
|---|---|
| `models/subscriptionRecord.test.js` | 10 |
| `models/usageLog.test.js` | 6 |
| `controllers/checkout.controller.test.js` | 6 |
| `models/idempotencyKey.test.js` | 5 |
| `controllers/webhook.controller.test.js` | 5 |
| `health.test.js` | 3 |
| `securityHeaders.test.js` | 2 |

`AUDITORIA.md` §2.5 y `ESTADO.md`, en el repositorio de documentación, cifran
esta suite en 35. **Las dos cifras son correctas, cada una en su fecha:** la
auditoría contó 6 ficheros y 35 casos ---la suma de los seis primeros de la
tabla---, y `securityHeaders.test.js`, con los 2 restantes, se añadió después,
en la sesión 3, al acotar la exención de CSP de `/docs`. Al retirarlas eran, por
tanto, 37 en 7 ficheros.

El desglose sale de la salida en JSON del ejecutor sobre `4596add`, no de un
recuento a ojo: contar `it(` a mano da 30, porque se saltan las pruebas anidadas
en un `describe` interior de `subscriptionRecord` y de `usageLog`. Ese descuadre
es de la cuenta manual y no tiene nada que ver con la diferencia entre 35 y 37.

## Por qué se retiran

Estaban en verde porque describían la implementación, no el contrato. Cada uno
de los desajustes que la sesión corrige estaba **protegido** por una de estas
pruebas, de modo que avanzar hacia `openapi/pricing.yaml` aparecía como una
regresión:

| Elemento | Suite anterior | `openapi/pricing.yaml` |
|---|---|---|
| Identidad | JWT verificado en el propio servicio (`jest.mock('jsonwebtoken')`) | Cabeceras `X-Account-Id`, `X-Auth-Channel`, `X-Role` propagadas por Kong |
| Claim de cuenta | `req.user.id`, tomado del claim `id` | `accountId`, tomado de `X-Account-Id` |
| Cuerpo de error | `{ status, message, stack }` | `ErrorReport` = `{ code, message, details? }` |
| Respuesta de `create-session` | `{ status: 'success', data: { url } }` | `{ sessionId, url }` |
| `planId` | Price ID de Stripe (`price_test123`) | Enum `free` \| `pro` \| `business` |
| Firma de webhook inválida | `400` | `401` |
| Cuerpo del `200` del webhook | `{ status: 'success', received: true }` | Respuesta sin `content`: cuerpo vacío |
| Canal de API | Rechazado: exigía `Authorization: Bearer` | Mismo endpoint, misma respuesta (regla 1 de CLAUDE.md) |

La columna izquierda es, literalmente, el catálogo de hallazgos de los issues
#65 y #66.

## Por qué se conservan

1. Documentan el comportamiento previo con precisión, que es lo que permite
   redactar en la memoria *qué* cambió y *por qué*.
2. Sirven de contraste con `tests/contract/`, derivados de la especificación en
   lugar de describir la implementación.

No deben corregirse ni adaptarse. Se borrarán cuando el capítulo
correspondiente de la memoria esté escrito.

## Límite de la suite de contrato que las sustituye

`toSatisfyApiSpec()` valida **la respuesta**, no la petición. Comprueba que el
código de estado esté declarado y que el cuerpo devuelto satisfaga el esquema
de esa respuesta; **no** comprueba que el cuerpo enviado satisfaga el
`requestBody` del contrato. Que una petición malformada reciba `400` se
verifica aquí escribiendo la petición malformada a mano, no derivándola de la
especificación: el esquema de entrada queda fuera de lo que estos tests
protegen. Es un límite del contrato como fuente de verdad, y va al capítulo 8
de la memoria.
