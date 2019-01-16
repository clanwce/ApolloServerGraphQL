const { MongoClient } = require("mongodb");

let mongo;
let client;

async function context(headers, secrets) {
  if (!mongo) {
    client = await MongoClient.connect(process.env.MDB_URL);
    mongo = client.db("clanwce");
  }
  return {
    headers,
    secrets,
    mongo
  };
}
