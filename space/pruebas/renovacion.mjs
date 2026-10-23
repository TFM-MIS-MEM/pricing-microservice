// ===========================================================
// Renovación del límite por minuto: la prueba 06b del estudio de la sesión 22,
// que fija el parche 0001.
//
// Se ejecuta dentro de space-server, con una clave de organización MANAGEMENT:
//   docker exec -i -e SPACE_API_KEY=… space-server node --input-type=module - < space/pruebas/renovacion.mjs
//
// Crea un contrato Free nuevo (8 unidades/minuto), consume 1,5 hasta que SPACE
// deniega, espera a que pase el primer reinicio y hace diez evaluaciones más.
//   - Sin el parche: tras el primer reinicio el contador del minuto se queda
//     en 1,5 y las diez se admiten; el resetTimeStamp no se mueve.
//   - Con el parche: se admiten seis (hasta 9 > 8), se deniegan cuatro y el
//     resetTimeStamp avanza al minuto siguiente.
// ===========================================================

const BASE = 'http://localhost:3000/api/v1';
const KEY = process.env.SPACE_API_KEY;
const U = `renovacion-${Date.now()}`;
const H = { 'x-api-key': KEY, 'content-type': 'application/json' };
const C = JSON.stringify({ 'frsaas-capacityUnitsPerMinute': 1.5, 'frsaas-capacityUnitsPerHour': 1.5, 'frsaas-capacityUnitsPerMonth': 1.5 });
const hhmmss = (d = new Date()) => d.toISOString().slice(11, 19);

const minute = async () => (await (await fetch(`${BASE}/contracts/${U}`, { headers: H })).json()).usageLevels.frsaas.capacityUnitsPerMinute;
const evaluate = async () => {
  const r = await (await fetch(`${BASE}/features/${U}/frsaas-identityVerification`, { method: 'POST', headers: H, body: C })).json();
  return r.eval;
};

const created = await fetch(`${BASE}/contracts`, {
  method: 'POST',
  headers: H,
  body: JSON.stringify({
    userContact: { userId: U, username: U },
    billingPeriod: { autoRenew: true, renewalDays: 30 },
    contractedServices: { frsaas: '1.1' },
    subscriptionPlans: { frsaas: 'FREE' },
    subscriptionAddOns: {},
  }),
});
console.log(`contrato ${U}: HTTP ${created.status}`);

let m = await minute();
console.log(`[${hhmmss()}] inicio: ${JSON.stringify(m)}`);
for (let i = 1; i <= 7; i++) console.log(`[${hhmmss()}] primer periodo, llamada ${i}: eval=${await evaluate()}`);
m = await minute();
console.log(`[${hhmmss()}] tras agotar: ${JSON.stringify(m)}`);

const reset = new Date(m.resetTimeStamp);
while (new Date() <= new Date(reset.getTime() + 1000)) await new Promise((r) => setTimeout(r, 500));

console.log(`[${hhmmss()}] pasado el reinicio de ${hhmmss(reset)}:`);
for (let i = 1; i <= 10; i++) {
  const e = await evaluate();
  console.log(`[${hhmmss()}] llamada ${i}: eval=${e}  minuto=${JSON.stringify(await minute())}`);
}
