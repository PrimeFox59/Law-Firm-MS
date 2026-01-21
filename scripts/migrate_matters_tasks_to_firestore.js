require('dotenv').config();
const { initFirebase } = require('../config/firebase');
const { Matter, Task, MatterAttorney } = require('../models');

const migrate = async () => {
  const { firestore } = initFirebase();

  const matters = await Matter.findAll({ include: [{ model: MatterAttorney, as: 'responsibleAttorneys' }] });
  const tasks = await Task.findAll();

  console.log(`Migrating ${matters.length} matters and ${tasks.length} tasks`);

  // Matters
  {
    const batchSize = 300;
    for (let i = 0; i < matters.length; i += batchSize) {
      const slice = matters.slice(i, i + batchSize);
      const batch = firestore.batch();
      slice.forEach((m) => {
        const attorneys = (m.responsibleAttorneys || []).map(a => String(a.user_id || a.id)).filter(Boolean);
        const visible = new Set([String(m.created_by), String(m.responsible_attorney_id), ...attorneys].filter(Boolean));
        const ref = firestore.collection('matters').doc(String(m.id));
        batch.set(ref, {
          id: String(m.id),
          matter_number: m.matter_number,
          matter_name: m.matter_name,
          client_id: m.client_id ? String(m.client_id) : null,
          responsible_attorney_id: m.responsible_attorney_id ? String(m.responsible_attorney_id) : null,
          responsible_attorney_ids: attorneys,
          visible_to: Array.from(visible),
          case_area: m.case_area,
          case_type: m.case_type,
          dispute_resolution: m.dispute_resolution,
          status: m.status,
          start_date: m.start_date || null,
          end_date: m.end_date || null,
          max_budget: m.max_budget || null,
          payment_method: m.payment_method || null,
          description: m.description || null,
          created_by: m.created_by ? String(m.created_by) : null,
          created_at: m.created_at || null,
          updated_at: m.updated_at || null
        }, { merge: true });
      });
      await batch.commit();
      console.log(`Matters migrated: ${Math.min(i + batchSize, matters.length)}/${matters.length}`);
    }
  }

  // Tasks
  {
    const batchSize = 300;
    for (let i = 0; i < tasks.length; i += batchSize) {
      const slice = tasks.slice(i, i + batchSize);
      const batch = firestore.batch();
      slice.forEach((t) => {
        const ref = firestore.collection('tasks').doc(String(t.id));
        batch.set(ref, {
          id: String(t.id),
          task_type: t.task_type,
          matter_id: t.matter_id ? String(t.matter_id) : null,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          start_date: t.start_date || null,
          due_date: t.due_date || null,
          assignee_id: t.assignee_id ? String(t.assignee_id) : null,
          notes: t.notes || null,
          hyperlink: t.hyperlink || null,
          created_by: t.created_by ? String(t.created_by) : null,
          created_at: t.created_at || null,
          updated_at: t.updated_at || null
        }, { merge: true });
      });
      await batch.commit();
      console.log(`Tasks migrated: ${Math.min(i + batchSize, tasks.length)}/${tasks.length}`);
    }
  }

  console.log('Migration complete');
  process.exit(0);
};

migrate().catch((err) => {
  console.error('Migration failed', err);
  process.exit(1);
});
