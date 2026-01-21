const { initFirebase } = require('../../config/firebase');
const { FieldValue } = require('firebase-admin/firestore');

const COLLECTION = 'matters';

const getCollection = () => initFirebase().firestore.collection(COLLECTION);

const findById = async (id) => {
  const doc = await getCollection().doc(String(id)).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
};

const findAllForUser = async ({ userId, isAdmin, search, status, dispute }) => {
  const col = getCollection();
  let query = col;

  if (!isAdmin) {
    // Basic filter; for shared attorneys, store an array responsible_attorney_ids
    query = query.where('visible_to', 'array-contains', String(userId));
  }

  if (status && status !== 'all') {
    query = query.where('status', '==', status);
  }

  // Firestore can't OR text search natively; do simple contains on name/number via where is not possible.
  // For demo, we ignore search or handle client-side; here we fetch then filter.
  const snap = await query.get();
  let matters = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (search) {
    const s = search.toLowerCase();
    matters = matters.filter(m =>
      (m.matter_name || '').toLowerCase().includes(s) ||
      (m.matter_number || '').toLowerCase().includes(s)
    );
  }

  if (dispute && dispute !== 'all') {
    matters = matters.filter(m => m.dispute_resolution === dispute);
  }

  return matters;
};

const create = async (data) => {
  const col = getCollection();
  const docRef = col.doc();
  const payload = {
    ...data,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp()
  };
  await docRef.set(payload);
  return { id: docRef.id, ...payload };
};

const update = async (id, data) => {
  const docRef = getCollection().doc(String(id));
  await docRef.set({ ...data, updated_at: FieldValue.serverTimestamp() }, { merge: true });
  const doc = await docRef.get();
  return { id: doc.id, ...doc.data() };
};

const setAttorneys = async (matterId, userIds) => {
  const docRef = getCollection().doc(String(matterId));
  await docRef.set({
    responsible_attorney_ids: userIds.map(String),
    visible_to: Array.from(new Set(userIds.map(String))),
    updated_at: FieldValue.serverTimestamp()
  }, { merge: true });
};

module.exports = {
  findById,
  findAllForUser,
  create,
  update,
  setAttorneys
};
