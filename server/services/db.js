const { MongoClient } = require("mongodb");
const { MONGODB_URI } = require("../config");

let cachedClient = null;

const connectDb = async () => {
  if (!MONGODB_URI) return null;
  if (cachedClient) return cachedClient;
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  cachedClient = client;
  return client;
};

module.exports = {
  connectDb
};
