require('dotenv').config();
const { initFirebase } = require('../config/firebase');
const { Contact, ContactEmail, ContactPhone, ContactAddress, Invoice, InvoiceBill, Matter } = require('../models');

const migrateContacts = async (firestore) => {
  const contacts = await Contact.findAll({
    include: [
      { model: ContactEmail, as: 'emails' },
      { model: ContactPhone, as: 'phones' },
      { model: ContactAddress, as: 'addresses' }
    ]
  });
  console.log(`Migrating ${contacts.length} contacts`);
  const batchSize = 300;
  for (let i = 0; i < contacts.length; i += batchSize) {
    const slice = contacts.slice(i, i + batchSize);
    const batch = firestore.batch();
    slice.forEach((c) => {
      const ref = firestore.collection('contacts').doc(String(c.id));
      batch.set(ref, {
        id: String(c.id),
        entity_type: c.entity_type,
        name: c.name,
        is_client: !!c.is_client,
        notes: c.notes,
        created_by: c.created_by ? String(c.created_by) : null,
        emails: (c.emails || []).map((e) => ({ email: e.email, email_type: e.email_type, is_primary: e.is_primary })),
        phones: (c.phones || []).map((p) => ({ phone: p.phone, phone_type: p.phone_type, is_primary: p.is_primary })),
        addresses: (c.addresses || []).map((a) => ({ address: a.address, address_type: a.address_type, is_primary: a.is_primary })),
        created_at: c.created_at || null,
        updated_at: c.updated_at || null
      }, { merge: true });
    });
    await batch.commit();
    console.log(`Contacts migrated: ${Math.min(i + batchSize, contacts.length)}/${contacts.length}`);
  }
};

const migrateInvoices = async (firestore) => {
  const invoices = await Invoice.findAll({ include: [{ model: InvoiceBill, as: 'bills' }, { model: Matter, as: 'matter' }] });
  console.log(`Migrating ${invoices.length} invoices`);
  const batchSize = 300;
  for (let i = 0; i < invoices.length; i += batchSize) {
    const slice = invoices.slice(i, i + batchSize);
    const batch = firestore.batch();
    slice.forEach((inv) => {
      const visible = new Set([
        inv.created_by,
        inv.matter?.created_by,
        inv.matter?.responsible_attorney_id
      ].filter(Boolean).map(String));
      const ref = firestore.collection('invoices').doc(String(inv.id));
      batch.set(ref, {
        id: String(inv.id),
        invoice_number: inv.invoice_number,
        contact_id: inv.contact_id ? String(inv.contact_id) : null,
        matter_id: inv.matter_id ? String(inv.matter_id) : null,
        issue_date: inv.issue_date,
        due_date: inv.due_date,
        subtotal: Number(inv.subtotal || 0),
        tax_rate: Number(inv.tax_rate || 0),
        tax_amount: Number(inv.tax_amount || 0),
        discount_amount: Number(inv.discount_amount || 0),
        total_amount: Number(inv.total_amount || 0),
        status: inv.status,
        notes: inv.notes,
        bills: (inv.bills || []).map((b) => ({
          description: b.description,
          quantity: Number(b.quantity || 1),
          unit_price: Number(b.unit_price || 0),
          amount: Number(b.amount || 0)
        })),
        created_by: inv.created_by ? String(inv.created_by) : null,
        matter_created_by: inv.matter?.created_by ? String(inv.matter.created_by) : null,
        matter_responsible_attorney: inv.matter?.responsible_attorney_id ? String(inv.matter.responsible_attorney_id) : null,
        visible_to: Array.from(visible),
        created_at: inv.created_at || null,
        updated_at: inv.updated_at || null
      }, { merge: true });
    });
    await batch.commit();
    console.log(`Invoices migrated: ${Math.min(i + batchSize, invoices.length)}/${invoices.length}`);
  }
};

const main = async () => {
  const { firestore } = initFirebase();
  await migrateContacts(firestore);
  await migrateInvoices(firestore);
  console.log('Migration complete');
  process.exit(0);
};

main().catch((err) => {
  console.error('Migration failed', err);
  process.exit(1);
});
