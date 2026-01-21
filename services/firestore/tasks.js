const { initFirebase } = require('../../config/firebase');
const { FieldValue } = require('firebase-admin/firestore');

const COLLECTION = 'tasks';

const getCollection = () => initFirebase().firestore.collection(COLLECTION);

const findById = async (id) => {
  const doc = await getCollection().doc(String(id)).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
};

const listForUser = async ({ userId, isAdmin, filters }) => {
  let query = getCollection();
  if (!isAdmin) {
    query = query.where('assignee_id', '==', String(userId));
  }
  if (filters?.status && filters.status !== 'all') {
    query = query.where('status', '==', filters.status);
  }
  if (filters?.priority && filters.priority !== 'all') {
    query = query.where('priority', '==', filters.priority);
  }
  if (filters?.matter_id && filters.matter_id !== 'all') {
    query = query.where('matter_id', '==', filters.matter_id);
  }

  // Firestore doesn't support LIKE; apply search client-side after fetch
  const snap = await query.get();
  let tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (filters?.search) {
    const s = filters.search.toLowerCase();
    tasks = tasks.filter(t => (t.title || '').toLowerCase().includes(s));
  }

  return tasks;
};

const listApprovals = async ({ userId }) => {
  const snap = await getCollection()
    .where('created_by', '==', String(userId))
    .where('status', '!=', 'completed')
    .orderBy('status')
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

const listByMatter = async (matterId) => {
  const snap = await getCollection().where('matter_id', '==', String(matterId)).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

const create = async (data) => {
  const docRef = data?.id ? getCollection().doc(String(data.id)) : getCollection().doc();
  const payload = {
    ...data,
    id: data?.id ? String(data.id) : docRef.id,
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

const remove = async (id) => {
  await getCollection().doc(String(id)).delete();
};

module.exports = {
  findById,
  listForUser,
  listApprovals,
  listByMatter,
  create,
  update,
  remove
};
