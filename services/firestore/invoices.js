const { initFirebase } = require('../../config/firebase');
const { FieldValue } = require('firebase-admin/firestore');

const COLLECTION = 'invoices';
const getCollection = () => initFirebase().firestore.collection(COLLECTION);

const serializeBills = (bills) => (Array.isArray(bills) ? bills.map((b) => ({ ...b })) : []);

const findById = async (id) => {
  const doc = await getCollection().doc(String(id)).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
};

const listForUser = async ({ userId, isAdmin, accessibleMatterIds = [], search, status }) => {
  let query = getCollection();
  if (status && status !== 'all') query = query.where('status', '==', status);
  if (!isAdmin) {
    query = query.where('visible_to', 'array-contains-any', [String(userId)]);
  }
  const snap = await query.get();
  let invoices = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  if (!isAdmin && accessibleMatterIds.length) {
    const set = new Set(accessibleMatterIds.map(String));
    invoices = invoices.filter((inv) => inv.created_by === String(userId) || (inv.matter_id && set.has(inv.matter_id)));
  }

  if (search) {
    const s = search.toLowerCase();
    invoices = invoices.filter((inv) => (inv.invoice_number || '').toLowerCase().includes(s));
  }

  invoices.sort((a, b) => {
    const ta = a.created_at?.toMillis ? a.created_at.toMillis() : new Date(a.created_at || 0).getTime();
    const tb = b.created_at?.toMillis ? b.created_at.toMillis() : new Date(b.created_at || 0).getTime();
    return (tb || 0) - (ta || 0);
  });

  return invoices;
};

const create = async (data) => {
  const docRef = data?.id ? getCollection().doc(String(data.id)) : getCollection().doc();
  const payload = {
    ...data,
    id: data?.id ? String(data.id) : docRef.id,
    bills: serializeBills(data.bills),
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
    visible_to: Array.from(new Set([data.created_by, data.matter_created_by, data.matter_responsible_attorney].filter(Boolean).map(String)))
  };
  await docRef.set(payload, { merge: true });
  return { id: docRef.id, ...payload };
};

const updateStatus = async (id, status) => {
  await getCollection().doc(String(id)).set({ status, updated_at: FieldValue.serverTimestamp() }, { merge: true });
};

const remove = async (id) => {
  await getCollection().doc(String(id)).delete();
};

module.exports = {
  findById,
  listForUser,
  create,
  updateStatus,
  remove
};
