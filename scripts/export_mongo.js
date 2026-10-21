const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const users = await mongoose.connection.db.collection('users').find().toArray();
  const subjects = await mongoose.connection.db.collection('subjects').find().toArray();
  const chunks = await mongoose.connection.db.collection('documentchunks').find().toArray();
  
  const targetPath = path.join(__dirname, 'mongo_data.json');
  fs.writeFileSync(targetPath, JSON.stringify({ users, subjects, chunks }, null, 2));
  console.log(`Exported ${users.length} users, ${subjects.length} subjects, ${chunks.length} chunks to ${targetPath}`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(e => {
  console.error('Export error:', e);
  process.exit(1);
});
