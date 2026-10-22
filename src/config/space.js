'use strict';

/**
 * Dónde está SPACE y con qué clave se le habla (#51).
 *
 * pricing mantiene en SPACE el contrato de cada cuenta: lo nova cuando Stripe
 * confirma una compra o una baja. fr-commercial lo lee para decidir cada
 * operación. Los dos alcanzan el servidor como `space-server:3000` por
 * tfm-network, nunca por el nginx de SPACE.
 *
 * Sin valores por defecto, como los precios de `plans.js`: un pricing que no
 * puede novar contratos cobraría un plan que fr-commercial no aplicaría. La
 * clave tiene que ser de organización (`org_…`): con una de usuario SPACE no
 * admite estas rutas. La emite `scripts/space-bootstrap.sh`, que la escribe en
 * el `.env` de este repositorio.
 */

const url = (process.env.SPACE_URL || '').trim().replace(/\/+$/, '');
const apiKey = (process.env.SPACE_API_KEY || '').trim();

if (!/^https?:\/\/[^/]+/.test(url)) {
  throw new Error(
    'SPACE_URL is required: the internal URL of space-server (http://space-server:3000).',
  );
}

if (!apiKey.startsWith('org_')) {
  throw new Error(
    'SPACE_API_KEY is required and must be a SPACE organization key (org_…). ' +
      'scripts/space-bootstrap.sh issues it.',
  );
}

module.exports = { url, apiKey };
