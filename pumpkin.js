#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const env = path.join(__dirname, '.env');
if (fs.existsSync(env)) process.loadEnvFile(env);

const usage = `usage:
  pumpkin issue add "<title>" ["<body>"]
  pumpkin issue ls
  pumpkin issue show <id>
  pumpkin issue edit <id> title|body "<value>"
  pumpkin issue done <id>
  pumpkin user add "<name>"
  pumpkin user ls
  pumpkin key add "<label>" <scope>
  pumpkin key ls
  pumpkin serve`;

const short = (id) => id.toString().slice(-6);

async function main(db, [cmd, sub, arg, arg2, arg3]) {
  if (!['issue', 'user', 'key', 'serve'].includes(cmd)) throw usage;
  const op = `${cmd} ${sub}`;
  const issues = db.collection('issues');
  const users = db.collection('users');
  const keys = db.collection('keys');
  const me = await users.findOne({ name: process.env.PUMPKIN_USER });
  if (!me) throw `unknown PUMPKIN_USER: ${process.env.PUMPKIN_USER}`;
  const names = new Map((await users.find().sort({ createdAt: 1 }).toArray()).map((u) => [u._id.toString(), u.name]));
  const one = async (filter) => {
    const matches = (await issues.find(filter).toArray()).filter((i) => i._id.toString().endsWith(arg));
    if (matches.length !== 1) throw `${matches.length} issues match ${arg}`;
    return matches[0];
  };

  if (cmd === 'serve') {
    require('./serve')(db, me);
  } else if (op === 'user add' && arg) {
    await users.insertOne({ name: arg, createdAt: new Date() }).catch((e) => { throw e.code === 11000 ? `user exists: ${arg}` : e; });
    console.log(`${arg} added by ${me.name}`);
  } else if (op === 'user ls') {
    for (const name of names.values()) console.log(name);
  } else if (op === 'key add' && arg && arg2) {
    await keys.createIndex({ key: 1 }, { unique: true });
    const key = crypto.randomBytes(16).toString('hex');
    await keys.insertOne({ key, label: arg, scopes: [arg2], once: true, usedAt: null, createdBy: me._id, createdAt: new Date() });
    console.log(`?key=${key}`);
  } else if (op === 'key ls') {
    for (const k of await keys.find().sort({ createdAt: 1 }).toArray())
      console.log(`${k.key}  ${k.label}  [${k.scopes}]  ${k.usedAt ? 'used ' + k.usedAt.toISOString().slice(0, 10) : 'unused'}`);
  } else if (op === 'issue add' && arg) {
    const { insertedId } = await issues.insertOne({ title: arg, body: arg2 || '', done: false, createdBy: me._id, createdAt: new Date() });
    console.log(`${short(insertedId)} added by ${me.name}`);
  } else if (op === 'issue ls') {
    for (const i of await issues.find({ done: false }).sort({ createdAt: 1 }).toArray())
      console.log(`${short(i._id)}  ${i.title}  (${names.get(i.createdBy.toString())})`);
  } else if (op === 'issue show' && arg) {
    const { _id, createdBy, ...rest } = await one({});
    console.log(JSON.stringify({ id: _id, ...rest, createdBy: names.get(createdBy.toString()) }, null, 2));
  } else if (op === 'issue edit' && ['title', 'body'].includes(arg2) && arg3 !== undefined) {
    const i = await one({});
    await issues.updateOne({ _id: i._id }, { $set: { [arg2]: arg3 } });
    console.log(`${short(i._id)} ${arg2} updated`);
  } else if (op === 'issue done' && arg) {
    const i = await one({ done: false });
    await issues.updateOne({ _id: i._id }, { $set: { done: true } });
    console.log(`${short(i._id)} done`);
  } else throw usage;
}

const client = new MongoClient(process.env.MONGODB_URI);
const args = process.argv.slice(2);
main(client.db(process.env.MONGODB_DB), args)
  .then(() => args[0] !== 'serve' && client.close())
  .catch((e) => { console.error(e.message || e); process.exitCode = 1; client.close(); });
