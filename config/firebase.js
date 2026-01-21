const admin = require('firebase-admin');

// Support two modes:
// 1) FIREBASE_SERVICE_ACCOUNT_BASE64: base64-encoded JSON string of service account.
// 2) Individual env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (with \n escaped).
const getCredential = () => {
  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (base64) {
    const json = Buffer.from(base64, 'base64').toString('utf8');
    return admin.credential.cert(JSON.parse(json));
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase credentials: set FIREBASE_SERVICE_ACCOUNT_BASE64 or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY');
  }

  // Allow \n-escaped private keys in env
  privateKey = privateKey.replace(/\\n/g, '\n');

  return admin.credential.cert({
    projectId,
    clientEmail,
    privateKey
  });
};

let app;
let firestore;
let storage;

const initFirebase = () => {
  if (app) return { app, firestore, storage };

  app = admin.initializeApp({
    credential: getCredential(),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined
  });

  firestore = admin.firestore();
  storage = admin.storage();

  return { app, firestore, storage };
};

module.exports = {
  initFirebase
};
