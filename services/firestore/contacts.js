const { initFirebase } = require('../../config/firebase');
const { FieldValue } = require('firebase-admin/firestore');

const COLLECTION = 'contacts';
const getCollection = () => initFirebase().firestore.collection(COLLECTION);

const normalizeArrays = (arr) => (Array.isArray(arr) ? arr : []).map((item) => ({ ...item }));

const findById = async (id) => {
  const doc = await getCollection().doc(String(id)).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
};

const list = async ({ search, filter }) => {
  let query = getCollection();
  if (filter === 'client') query = query.where('is_client', '==', true);
  if (filter === 'non-client') query = query.where('is_client', '==', false);
  const snap = await query.get();
  let contacts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (search) {
    const s = search.toLowerCase();
    contacts = contacts.filter((c) => (c.name || '').toLowerCase().includes(s));
  }
  // sort by created_at desc fallback id
  contacts.sort((a, b) => {
    const ta = a.created_at?.toMillis ? a.created_at.toMillis() : new Date(a.created_at || 0).getTime();
    const tb = b.created_at?.toMillis ? b.created_at.toMillis() : new Date(b.created_at || 0).getTime();
    return (tb || 0) - (ta || 0);
  });
  return contacts;
};

const create = async (data) => {
  const docRef = data?.id ? getCollection().doc(String(data.id)) : getCollection().doc();
  const payload = {
    ...data,
    id: data?.id ? String(data.id) : docRef.id,
    emails: normalizeArrays(data.emails),
    phones: normalizeArrays(data.phones),
    addresses: normalizeArrays(data.addresses),
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp()
  };
  await docRef.set(payload, { merge: true });
  return { id: docRef.id, ...payload };
};

const update = async (id, data) => {
  const docRef = getCollection().doc(String(id));
  const payload = {
    ...data,
    id: String(id),
    emails: normalizeArrays(data.emails),
    phones: normalizeArrays(data.phones),
    addresses: normalizeArrays(data.addresses),
    updated_at: FieldValue.serverTimestamp()
  };
  await docRef.set(payload, { merge: true });
  const doc = await docRef.get();
  return { id: doc.id, ...doc.data() };
};

const remove = async (id) => {
  await getCollection().doc(String(id)).delete();
};

module.exports = {
  findById,
  list,
  create,
  update,
  remove
};
