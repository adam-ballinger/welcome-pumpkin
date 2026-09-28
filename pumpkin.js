#!/usr/bin/env node
const path = require('path');
const { MongoClient } = require('mongodb');

process.loadEnvFile(path.join(__dirname, '.env'));

const usage = `usage:
  pumpkin issue add "<title>" ["<body>"]
  pumpkin issue ls
  pumpkin issue show <id>
  pumpkin issue done <id>`;

const short = (id) => id.toString().slice(-6);

async function main(db, [cmd, sub, arg, body]) {
  if (cmd !== 'issue') throw usage;
  const issues = db.collection('issues');
  const users = db.collection('users');
  const me = await users.findOne({ name: process.env.PUMPKIN_USER });
  if (!me) throw `unknown PUMPKIN_USER: ${process.env.PUMPKIN_USER}`;
  const names = new Map((await users.find().toArray()).map((u) => [u._id.toString(), u.name]));
  const one = async (filter) => {
    const matches = (await issues.find(filter).toArray()).filter((i) => i._id.toString().endsWith(arg));
    if (matches.length !== 1) throw `${matches.length} issues match ${arg}`;
    return matches[0];
  };

  if (sub === 'add' && arg) {
    const { insertedId } = await issues.insertOne({ title: arg, body: body || '', done: false, createdBy: me._id, createdAt: new Date() });
    console.log(`${short(insertedId)} added by ${me.name}`);
  } else if (sub === 'ls') {
    for (const i of await issues.find({ done: false }).sort({ createdAt: 1 }).toArray())
      console.log(`${short(i._id)}  ${i.title}  (${names.get(i.createdBy.toString())})`);
  } else if (sub === 'show' && arg) {
    const { _id, createdBy, ...rest } = await one({});
    console.log(JSON.stringify({ id: _id, ...rest, createdBy: names.get(createdBy.toString()) }, null, 2));
  } else if (sub === 'done' && arg) {
    const i = await one({ done: false });
    await issues.updateOne({ _id: i._id }, { $set: { done: true } });
    console.log(`${short(i._id)} done`);
  } else throw usage;
}

const client = new MongoClient(process.env.MONGODB_URI);
main(client.db(process.env.MONGODB_DB), process.argv.slice(2))
  .catch((e) => { console.error(e.message || e); process.exitCode = 1; })
  .finally(() => client.close());
