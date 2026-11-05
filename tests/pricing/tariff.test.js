'use strict';

/**
 * La tarifa del SaaS (`pricing/fr-commercial-pricing.yaml`) frente a la versión
 * publicada en SPHERE que el SaaS tiene fijada (`pricing/sphere.env`).
 *
 * Hay tres copias de la misma tarifa: la del repositorio, la publicada en
 * SPHERE y la que SPACE carga desde SPHERE. Esta suite ata las dos primeras; la
 * tercera la ata `space-bootstrap.sh`, que carga en SPACE la versión fijada.
 *
 * La comparación es por la huella funcional que publica SPHERE en su manifiesto
 * (`contentHash`): SHA-256 del YAML canonizado —claves ordenadas— sin
 * `saasName`. El algoritmo es el de SPHERE
 * (`api/src/main/services/PermanentLinkService.ts`, `functionalHash`) y el de
 * SPACE (`api/src/main/services/sphere/SphereClient.ts`), que coinciden.
 *
 * La comprobación contra el manifiesto público necesita red y depende de un
 * servicio externo, así que solo se ejecuta con `SPHERE_ONLINE=1`. La CI ejecuta
 * la parte que no la necesita: que la copia del repositorio tiene la huella que
 * `sphere.env` dice que tiene la versión fijada.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yaml = require('js-yaml');
const { retrievePricingFromPath } = require('pricing4ts/server');

const PRICING_DIR = path.resolve(__dirname, '..', '..', 'pricing');
const TARIFF_PATH = path.join(PRICING_DIR, 'fr-commercial-pricing.yaml');

/** Lee `sphere.env` (líneas `CLAVE=valor`, comentarios con `#`). */
function readSphereEnv() {
  const text = fs.readFileSync(path.join(PRICING_DIR, 'sphere.env'), 'utf8');
  return Object.fromEntries(
    text
      .split('\n')
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1).trim()]),
  );
}

/** La huella funcional de SPHERE, reproducida. */
function functionalHash(text) {
  // eslint-disable-next-line no-unused-vars
  const { saasName, ...functional } = yaml.load(text);
  const canonical = (v) =>
    Array.isArray(v)
      ? v.map(canonical)
      : v && typeof v === 'object' && !(v instanceof Date)
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((k) => [k, canonical(v[k])]),
          )
        : v;
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonical(functional)))
    .digest('hex');
}

const sphere = readSphereEnv();
const tariffText = fs.readFileSync(TARIFF_PATH, 'utf8');

describe('Tarifa', () => {
  it('es Pricing2Yaml válido para pricing4ts 0.12.1, la versión que usa SPACE', () => {
    const pricing = retrievePricingFromPath(TARIFF_PATH);

    expect(pricing.syntaxVersion).toBe('3.1');
    expect(pricing.version).toBe(sphere.SPHERE_PRICING_VERSION);
    expect(Object.keys(pricing.plans)).toEqual(['FREE', 'PRO', 'BUSINESS']);
  });

  // El nombre del servicio en SPACE (`faceapi`) no sale de `saasName`, sino del
  // nombre de la tarifa en SPHERE, en minúsculas. `saasName` se mantiene igual
  // que en el YAML que publica SPHERE, aunque la huella lo excluya.
  it('se llama como la tarifa en SPHERE (FaceAPI)', () => {
    expect(yaml.load(tariffText).saasName).toBe('FaceAPI');
  });

  it('toda funcionalidad lleva `expression`: sin ella, SPACE la evalúa siempre a false', () => {
    const { features } = yaml.load(tariffText);
    const missing = Object.keys(features).filter((name) => !features[name].expression);

    expect(missing).toEqual([]);
  });

  it('ninguna expresión nombra los límites de estado, que cuenta fr-commercial', () => {
    const { features } = yaml.load(tariffText);
    const naming = Object.keys(features).filter((name) =>
      /maxFaces|maxGalleries/.test(features[name].expression),
    );

    expect(naming).toEqual([]);
  });

  it('tiene la huella funcional de la versión fijada en sphere.env', () => {
    expect(functionalHash(tariffText)).toBe(sphere.SPHERE_PRICING_CONTENT_HASH);
  });
});

const online = process.env.SPHERE_ONLINE === '1' ? describe : describe.skip;

online('Tarifa frente al manifiesto público de SPHERE (SPHERE_ONLINE=1)', () => {
  it('la versión fijada está publicada con la misma huella que la copia del repositorio', async () => {
    const res = await fetch(
      `https://sphere.score.us.es/api/v1/public/pricings/${sphere.SPHERE_PRICING_ID}`,
    );
    expect(res.status).toBe(200);

    const manifest = await res.json();
    const pinned = manifest.versions.find((v) => v.versionId === sphere.SPHERE_PRICING_VERSION_ID);

    expect(pinned).toMatchObject({
      version: sphere.SPHERE_PRICING_VERSION,
      contentHash: functionalHash(tariffText),
    });
  });
});
