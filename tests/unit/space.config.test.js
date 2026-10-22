'use strict';

/**
 * Guarda de arranque de SPACE (#51): sin URL o sin clave de organización, el
 * módulo no carga y el servicio no arranca.
 */

const load = (env) => {
  const saved = { SPACE_URL: process.env.SPACE_URL, SPACE_API_KEY: process.env.SPACE_API_KEY };
  Object.assign(process.env, env);
  try {
    let config;
    jest.isolateModules(() => {
      config = require('../../src/config/space');
    });
    return config;
  } finally {
    Object.assign(process.env, saved);
  }
};

describe('config/space', () => {
  it.each(['', 'space-server:3000', 'ftp://space-server'])('rechaza SPACE_URL "%s"', (url) => {
    expect(() => load({ SPACE_URL: url })).toThrow('SPACE_URL');
  });

  it.each(['', 'usr_una-clave-de-usuario', 'cualquier-cosa'])(
    'rechaza SPACE_API_KEY "%s": tiene que ser de organización',
    (key) => {
      expect(() => load({ SPACE_API_KEY: key })).toThrow('SPACE_API_KEY');
    },
  );

  it('acepta una URL interna y quita la barra final', () => {
    expect(load({ SPACE_URL: 'http://space-server:3000/' }).url).toBe('http://space-server:3000');
  });
});
