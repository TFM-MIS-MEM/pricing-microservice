'use strict';

/**
 * Conexión a la base de datos de test.
 *
 * Cada worker de Jest usa su propia base de datos lógica dentro del mismo
 * servidor en memoria, para que los ficheros que se ejecutan en paralelo queden
 * aislados.
 */

const mongoose = require('mongoose');

const dbName = () => `pricing_contract_${process.env.JEST_WORKER_ID || '1'}`;

const connect = async () => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: dbName() });
};

const clear = async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
};

const disconnect = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
};

module.exports = { connect, clear, disconnect };
