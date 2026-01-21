const { initFirebase } = require('../../config/firebase');
const bcrypt = require('bcryptjs');

const COLLECTION = 'users';

const mapSequelizeUser = (user) => {
  if (!user) return null;
  return {
    id: String(user.id),
    full_name: user.full_name,
    email: user.email,
    password: user.password || null,
    phone: user.phone || null,
    avatar: user.avatar || null,
    company: user.company || null,
    account_type: user.account_type || 'staff',
    hourly_rate: Number(user.hourly_rate || 0),
    language: user.language || 'en',
    theme: user.theme || 'light',
    is_active: user.is_active !== false,
    google_id: user.google_id || null,
    google_access_token: user.google_access_token || null,
    google_refresh_token: user.google_refresh_token || null,
    google_token_expiry: user.google_token_expiry || null,
    google_connected: !!user.google_connected,
    last_login: user.last_login || null,
    notify_task_assigned: user.notify_task_assigned !== false,
    notify_task_completed: user.notify_task_completed !== false,
    notify_task_deadline: user.notify_task_deadline !== false,
    notify_approval_request: user.notify_approval_request !== false,
    notify_approval_result: user.notify_approval_result !== false,
    notify_invoice: user.notify_invoice !== false,
    notify_payment: user.notify_payment !== false,
    notify_matter: user.notify_matter !== false,
    email_task_assigned: user.email_task_assigned !== false,
    email_task_due_soon: user.email_task_due_soon !== false,
    email_task_overdue: user.email_task_overdue !== false,
    email_task_completed: user.email_task_completed !== false,
    email_approval_request: user.email_approval_request !== false,
    email_approval_result: user.email_approval_result !== false,
    timer_running: !!user.timer_running,
    timer_started_at: user.timer_started_at || null,
    timer_elapsed_ms: Number(user.timer_elapsed_ms || 0)
  };
};

const getCollection = () => {
  const { firestore } = initFirebase();
  return firestore.collection(COLLECTION);
};

const findByEmail = async (email) => {
  const snap = await getCollection().where('email', '==', email).limit(1).get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
};

const findById = async (id) => {
  const doc = await getCollection().doc(String(id)).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
};

const createFromSequelize = async (user) => {
  const data = mapSequelizeUser(user);
  if (!data) return null;
  const docRef = getCollection().doc(String(data.id));
  await docRef.set(data, { merge: true });
  return { id: docRef.id, ...data };
};

const upsert = async (userData) => {
  const { id } = userData;
  const docRef = id ? getCollection().doc(String(id)) : getCollection().doc();
  await docRef.set(userData, { merge: true });
  return { id: docRef.id, ...userData };
};

const updateLastLogin = async (id) => {
  if (!id) return;
  await getCollection().doc(String(id)).set({ last_login: new Date() }, { merge: true });
};

const validatePassword = async (user, password) => {
  if (!user || !user.password) return false;
  return bcrypt.compare(password, user.password);
};

module.exports = {
  findByEmail,
  findById,
  createFromSequelize,
  updateLastLogin,
  validatePassword,
  upsert,
  mapSequelizeUser
};
