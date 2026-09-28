#!/usr/bin/env node
const path = require('path');
const { MongoClient } = require('mongodb');

process.loadEnvFile(path.join(__dirname, '.env'));

const usage = `usage:
  pumpkin issue add "<title>"
  pumpkin issue ls
  pumpkin issue done <id>`;

const short = (id) => id.toString().slice(-6);

async function main(db, [cmd, sub, arg]) {
  if (cmd !== 'issue') throw usage;
  const issues = db.collection('issues');
  const users = db.collection('users');
  const me = await users.findOne({ name: process.env.PUMPKIN_USER });
  if (!me) throw `unknown PUMPKIN_USER: ${process.env.PUMPKIN_USER}`;

  if (sub === 'add' && arg) {
    const { insertedId } = await issues.insertOne({ title: arg, done: false, createdBy: me._id, createdAt: new Date() });
    console.log(`${short(insertedId)} added by ${me.name}`);
  } else if (sub === 'ls') {
    const names = new Map((await users.find().toArray()).map((u) => [u._id.toString(), u.name]));
    for (const i of await issues.find({ done: false }).sort({ createdAt: 1 }).toArray())
      console.log(`${short(i._id)}  ${i.title}  (${names.get(i.createdBy.toString())})`);
  } else if (sub === 'done' && arg) {
    const matches = (await issues.find({ done: false }).toArray()).filter((i) => i._id.toString().endsWith(arg));
    if (matches.length !== 1) throw `${matches.length} open issues match ${arg}`;
    await issues.updateOne({ _id: matches[0]._id }, { $set: { done: true } });
    console.log(`${short(matches[0]._id)} done`);
  } else throw usage;
}

const client = new MongoClient(process.env.MONGODB_URI);
main(client.db(process.env.MONGODB_DB), process.argv.slice(2))
  .catch((e) => { console.error(e.message || e); process.exitCode = 1; })
  .finally(() => client.close());
