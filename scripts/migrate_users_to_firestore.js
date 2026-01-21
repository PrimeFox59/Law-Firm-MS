// One-off helper to migrate users from SQLite (Sequelize) to Firestore.
// Run locally: node scripts/migrate_users_to_firestore.js
// Prereq: set Firebase credentials in env (see .env.example).

require('dotenv').config();
const { User } = require('../models');
const { initFirebase } = require('../config/firebase');
const { mapSequelizeUser } = require('../services/firestore/users');

const migrate = async () => {
  const { firestore } = initFirebase();
  const users = await User.findAll();
  console.log(`Found ${users.length} users to migrate`);

  const batchSize = 300;
  for (let i = 0; i < users.length; i += batchSize) {
    const slice = users.slice(i, i + batchSize);
    const batch = firestore.batch();
    slice.forEach((u) => {
      const data = mapSequelizeUser(u.toJSON ? u.toJSON() : u);
      const ref = firestore.collection('users').doc(String(data.id));
      batch.set(ref, data, { merge: true });
    });
    await batch.commit();
    console.log(`Migrated ${Math.min(i + batchSize, users.length)} / ${users.length}`);
  }

  console.log('Done');
  process.exit(0);
};

migrate().catch((err) => {
  console.error('Migration failed', err);
  process.exit(1);
});
