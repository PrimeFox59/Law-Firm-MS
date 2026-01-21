require('dotenv').config();

const {
  sequelize,
  User,
  Contact,
  ContactEmail,
  ContactPhone,
  ContactAddress,
  Matter,
  Task,
  Event,
  EventAttendee,
  Invoice,
  InvoiceBill,
  Deposit,
  PaymentProof,
  CostJournal
} = require('../models');

// Default users to seed
const defaultUsers = [
  {
    full_name: 'Admin User',
    email: 'admin@lawfirm.com',
    password: 'admin123',
    account_type: 'admin',
    company: 'Law Firm Management',
    phone: '+62812345678',
    hourly_rate: 0,
    is_active: true
  },
  {
    full_name: 'John Attorney',
    email: 'attorney@lawfirm.com',
    password: 'attorney123',
    account_type: 'attorney',
    company: 'Law Firm Management',
    phone: '+62812345679',
    hourly_rate: 500000,
    is_active: true
  },
  {
    full_name: 'Jane Staff',
    email: 'staff@lawfirm.com',
    password: 'staff123',
    account_type: 'staff',
    company: 'Law Firm Management',
    phone: '+62812345680',
    hourly_rate: 200000,
    is_active: true
  },
  {
    full_name: 'Client Example',
    email: 'client@example.com',
    password: 'client123',
    account_type: 'client',
    company: 'Example Corp',
    phone: '+62812345681',
    hourly_rate: 0,
    is_active: true
  }
];

const seedDatabase = async () => {
  try {
    console.log('Starting database seeding...');

    // Sync database (create tables)
    await sequelize.sync({ force: true });
    console.log('Database tables created');

    

    // Insert users
    const createdUsers = {};
    for (const userData of defaultUsers) {
      const user = await User.create(userData);
      createdUsers[user.account_type] = user;
      console.log(`Created user: ${user.full_name} (${user.account_type}) - ${user.email}`);
    }

    // Contacts with details
    const contacts = await Promise.all([
      Contact.create({ name: 'Acme Manufacturing', entity_type: 'company', is_client: true, created_by: createdUsers.admin.id }),
      Contact.create({ name: 'Budi Santoso', entity_type: 'individual', is_client: true, created_by: createdUsers.admin.id }),
      Contact.create({ name: 'Clara Mahendra', entity_type: 'individual', is_client: false, created_by: createdUsers.admin.id })
    ]);

    await ContactEmail.bulkCreate([
      { contact_id: contacts[0].id, email: 'legal@acme.co.id', email_type: 'work', is_primary: true },
      { contact_id: contacts[1].id, email: 'budi@example.com', email_type: 'personal', is_primary: true }
    ]);

    await ContactPhone.bulkCreate([
      { contact_id: contacts[0].id, phone: '+622112345678', phone_type: 'office', is_primary: true },
      { contact_id: contacts[1].id, phone: '+628119998888', phone_type: 'mobile', is_primary: true }
    ]);

    await ContactAddress.bulkCreate([
      { contact_id: contacts[0].id, address: 'Jl. Industri No.1, Jakarta', address_type: 'office', is_primary: true },
      { contact_id: contacts[1].id, address: 'Jl. Melati No.5, Bandung', address_type: 'home', is_primary: true }
    ]);

    // Matters
    const matters = await Promise.all([
      Matter.create({
        matter_number: 'MAT-2026-001',
        matter_name: 'Contract Review - Acme',
        client_id: contacts[0].id,
        responsible_attorney_id: createdUsers.attorney.id,
        case_area: 'Corporate',
        case_type: 'Contract',
        dispute_resolution: 'negotiation',
        status: 'active',
        start_date: new Date(),
        max_budget: 150000000,
        payment_method: 'Bank Transfer',
        description: 'Review and negotiate master service agreement',
        created_by: createdUsers.admin.id
      }),
      Matter.create({
        matter_number: 'MAT-2026-002',
        matter_name: 'Litigation Support - Budi',
        client_id: contacts[1].id,
        responsible_attorney_id: createdUsers.attorney.id,
        case_area: 'Civil',
        case_type: 'Litigation',
        dispute_resolution: 'litigation',
        status: 'pending',
        start_date: new Date(),
        max_budget: 75000000,
        payment_method: 'Installment',
        description: 'Support for civil dispute in Bandung court',
        created_by: createdUsers.admin.id
      })
    ]);

    // Tasks
    await Task.bulkCreate([
      {
        task_type: 'matter',
        matter_id: matters[0].id,
        title: 'Draft contract markup',
        description: 'Prepare first round markup for MSA',
        status: 'in_progress',
        priority: 'high',
        start_date: new Date(),
        due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        assignee_id: createdUsers.staff.id,
        created_by: createdUsers.attorney.id
      },
      {
        task_type: 'matter',
        matter_id: matters[1].id,
        title: 'Collect evidence bundle',
        description: 'Gather exhibits and witness statements',
        status: 'pending',
        priority: 'medium',
        start_date: new Date(),
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        assignee_id: createdUsers.staff.id,
        created_by: createdUsers.attorney.id
      }
    ]);

    // Events with attendees
    const events = await Event.bulkCreate([
      {
        title: 'Kickoff with Acme',
        description: 'Project alignment call',
        start_datetime: new Date(),
        end_datetime: new Date(Date.now() + 60 * 60 * 1000),
        location: 'Zoom',
        category: 'Meeting',
        matter_id: matters[0].id,
        is_all_day: false,
        notification_minutes: 30,
        created_by: createdUsers.attorney.id
      },
      {
        title: 'Court hearing - Bandung',
        description: 'Preliminary hearing',
        start_datetime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        end_datetime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        location: 'Pengadilan Negeri Bandung',
        category: 'Hearing',
        matter_id: matters[1].id,
        is_all_day: false,
        notification_minutes: 60,
        created_by: createdUsers.attorney.id
      }
    ], { returning: true });

    await EventAttendee.bulkCreate([
      { event_id: events[0].id, user_id: createdUsers.attorney.id, response_status: 'accepted' },
      { event_id: events[0].id, user_id: createdUsers.staff.id, response_status: 'accepted' },
      { event_id: events[1].id, user_id: createdUsers.attorney.id, response_status: 'accepted' }
    ]);

    // Invoices and bills
    const invoice = await Invoice.create({
      invoice_number: 'INV-2026-001',
      matter_id: matters[0].id,
      contact_id: contacts[0].id,
      issue_date: new Date(),
      due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      subtotal: 100000000,
      tax_rate: 11,
      tax_amount: 11000000,
      discount_amount: 0,
      total_amount: 111000000,
      paid_amount: 30000000,
      status: 'partial',
      notes: 'Advance billing for contract review',
      has_installment: true,
      created_by: createdUsers.admin.id
    });

    await InvoiceBill.bulkCreate([
      { invoice_id: invoice.id, description: 'Legal fees - MSA review', quantity: 10, unit_price: 8000000, amount: 80000000 },
      { invoice_id: invoice.id, description: 'Research and advisory', quantity: 5, unit_price: 4000000, amount: 20000000 }
    ]);

    // Deposits and payments
    await Deposit.create({
      contact_id: contacts[0].id,
      matter_id: matters[0].id,
      amount: 50000000,
      deposit_date: new Date(),
      status: 'active',
      notes: 'Initial retainer',
      created_by: createdUsers.admin.id
    });

    await PaymentProof.create({
      invoice_id: invoice.id,
      amount: 30000000,
      payment_date: new Date(),
      payment_method: 'Bank Transfer',
      proof_file: null,
      notes: 'First installment',
      uploaded_by: createdUsers.staff.id
    });

    // Cost journals (time and expense)
    await CostJournal.bulkCreate([
      {
        entry_type: 'time',
        matter_id: matters[0].id,
        user_id: createdUsers.attorney.id,
        date: new Date(),
        description: 'Contract review session',
        hours: 2.5,
        rate: 800000,
        is_billable: true,
        is_billed: false
      },
      {
        entry_type: 'expense',
        matter_id: matters[1].id,
        user_id: createdUsers.staff.id,
        date: new Date(),
        description: 'Travel to court',
        expense_category: 'Transport',
        amount: 750000,
        is_billable: true,
        is_billed: false
      }
    ]);

    console.log('\n=== DATABASE SEEDING COMPLETED ===\n');
    console.log('Default Accounts Created:');
    console.log('1. Admin     - admin@lawfirm.com     / admin123');
    console.log('2. Attorney  - attorney@lawfirm.com  / attorney123');
    console.log('3. Staff     - staff@lawfirm.com     / staff123');
    console.log('4. Client    - client@example.com    / client123');
    console.log('\nDummy data added: contacts, matters, tasks, events, invoices, deposits, and cost journals.');
    console.log('\nYou can now start the application with: npm start');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
