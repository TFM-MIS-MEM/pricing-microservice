/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  // Se ejecuta antes de cargar cada suite: define los secretos con valores de
  // relleno para que la batería no dependa de que exista un .env.
  setupFiles: ['<rootDir>/tests/setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/tests/setup.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover'],
  verbose: true,
};
