const sequelize = require('../config/database');
const User = require('./User');
const Contact = require('./Contact');
const { ContactEmail, ContactPhone, ContactAddress } = require('./ContactDetails');
const Matter = require('./Matter');
const MatterAttorney = require('./MatterAttorney');
const Task = require('./Task');
const { Event, EventAttendee } = require('./Event');
const Document = require('./Document');
const CostJournal = require('./CostJournal');
const CostJournalApproval = require('./CostJournalApproval');
const { Invoice, InvoiceBill } = require('./Invoice');
const { Deposit, PaymentProof } = require('./Transaction');
const ActivityLog = require('./ActivityLog');
const ChatMessage = require('./ChatMessage');
const Hierarchy = require('./Hierarchy');
const DmMessage = require('./DmMessage');

// Define Associations

// User Associations
User.hasMany(Contact, { foreignKey: 'created_by', as: 'createdContacts' });
User.hasMany(Matter, { foreignKey: 'created_by', as: 'createdMatters' });
User.hasMany(Matter, { foreignKey: 'responsible_attorney_id', as: 'responsibleMatters' });
User.belongsToMany(Matter, { through: MatterAttorney, as: 'sharedMatters', foreignKey: 'user_id', otherKey: 'matter_id' });
User.hasMany(Task, { foreignKey: 'created_by', as: 'createdTasks' });
User.hasMany(Task, { foreignKey: 'assignee_id', as: 'assignedTasks' });
User.hasMany(Event, { foreignKey: 'created_by', as: 'createdEvents' });
User.hasMany(Document, { foreignKey: 'created_by', as: 'createdDocuments' });
User.hasMany(CostJournal, { foreignKey: 'user_id', as: 'costJournals' });
User.hasMany(Invoice, { foreignKey: 'created_by', as: 'createdInvoices' });
User.hasMany(ActivityLog, { foreignKey: 'user_id', as: 'activityLogs' });
User.hasMany(ChatMessage, { foreignKey: 'user_id', as: 'chatMessages' });
User.hasMany(DmMessage, { foreignKey: 'sender_id', as: 'sentDmMessages' });
User.hasMany(DmMessage, { foreignKey: 'receiver_id', as: 'receivedDmMessages' });

// Contact Associations
Contact.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Contact.hasMany(ContactEmail, { foreignKey: 'contact_id', as: 'emails' });
Contact.hasMany(ContactPhone, { foreignKey: 'contact_id', as: 'phones' });
Contact.hasMany(ContactAddress, { foreignKey: 'contact_id', as: 'addresses' });
Contact.hasMany(Matter, { foreignKey: 'client_id', as: 'matters' });
Contact.hasMany(Invoice, { foreignKey: 'contact_id', as: 'invoices' });
Contact.hasMany(Document, { foreignKey: 'contact_id', as: 'documents' });
Contact.hasMany(Deposit, { foreignKey: 'contact_id', as: 'deposits' });

// ContactDetails Associations
ContactEmail.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' });
ContactPhone.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' });
ContactAddress.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' });

// Matter Associations
Matter.belongsTo(Contact, { foreignKey: 'client_id', as: 'client' });
Matter.belongsTo(User, { foreignKey: 'responsible_attorney_id', as: 'responsibleAttorney' });
Matter.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Matter.belongsToMany(User, { through: MatterAttorney, as: 'responsibleAttorneys', foreignKey: 'matter_id', otherKey: 'user_id' });
Matter.hasMany(Task, { foreignKey: 'matter_id', as: 'tasks' });
Matter.hasMany(Event, { foreignKey: 'matter_id', as: 'events' });
Matter.hasMany(Document, { foreignKey: 'matter_id', as: 'documents' });
Matter.hasMany(CostJournal, { foreignKey: 'matter_id', as: 'costJournals' });
Matter.hasMany(Invoice, { foreignKey: 'matter_id', as: 'invoices' });
Matter.hasMany(Deposit, { foreignKey: 'matter_id', as: 'deposits' });
Matter.hasMany(ChatMessage, { foreignKey: 'matter_id', as: 'messages' });

// Task Associations
Task.belongsTo(Matter, { foreignKey: 'matter_id', as: 'matter' });
Task.belongsTo(User, { foreignKey: 'assignee_id', as: 'assignee' });
Task.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Task.hasMany(Document, { foreignKey: 'task_id', as: 'documents' });

// Event Associations
Event.belongsTo(Matter, { foreignKey: 'matter_id', as: 'matter' });
Event.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Event.hasMany(EventAttendee, { foreignKey: 'event_id', as: 'attendees' });

EventAttendee.belongsTo(Event, { foreignKey: 'event_id', as: 'event' });
EventAttendee.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Document Associations
Document.belongsTo(Matter, { foreignKey: 'matter_id', as: 'matter' });
Document.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' });
Document.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Document.belongsTo(Document, { foreignKey: 'parent_id', as: 'parent' });
Document.hasMany(Document, { foreignKey: 'parent_id', as: 'children' });
Document.belongsTo(Task, { foreignKey: 'task_id', as: 'task' });

// CostJournal Associations
CostJournal.belongsTo(Matter, { foreignKey: 'matter_id', as: 'matter' });
CostJournal.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
CostJournal.belongsTo(Invoice, { foreignKey: 'invoice_id', as: 'invoice' });
CostJournal.hasOne(CostJournalApproval, { foreignKey: 'cost_journal_id', as: 'approval' });
CostJournalApproval.belongsTo(CostJournal, { foreignKey: 'cost_journal_id', as: 'journal' });
CostJournalApproval.belongsTo(User, { foreignKey: 'approver_id', as: 'approver' });
CostJournalApproval.belongsTo(User, { foreignKey: 'requested_by', as: 'requester' });

// Invoice Associations
Invoice.belongsTo(Matter, { foreignKey: 'matter_id', as: 'matter' });
Invoice.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' });
Invoice.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Invoice.belongsTo(User, { foreignKey: 'approved_by', as: 'approver' });
Invoice.hasMany(InvoiceBill, { foreignKey: 'invoice_id', as: 'bills' });
Invoice.hasMany(PaymentProof, { foreignKey: 'invoice_id', as: 'paymentProofs' });

InvoiceBill.belongsTo(Invoice, { foreignKey: 'invoice_id', as: 'invoice' });

// Transaction Associations
Deposit.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' });
Deposit.belongsTo(Matter, { foreignKey: 'matter_id', as: 'matter' });
Deposit.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

PaymentProof.belongsTo(Invoice, { foreignKey: 'invoice_id', as: 'invoice' });
PaymentProof.belongsTo(User, { foreignKey: 'uploaded_by', as: 'uploader' });

// ActivityLog Associations
ActivityLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// ChatMessage Associations
ChatMessage.belongsTo(Matter, { foreignKey: 'matter_id', as: 'matter' });
ChatMessage.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// DM Associations
DmMessage.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });
DmMessage.belongsTo(User, { foreignKey: 'receiver_id', as: 'receiver' });

// MatterAttorney Associations
MatterAttorney.belongsTo(Matter, { foreignKey: 'matter_id' });
MatterAttorney.belongsTo(User, { foreignKey: 'user_id' });

module.exports = {
  sequelize,
  User,
  Contact,
  ContactEmail,
  ContactPhone,
  ContactAddress,
  Matter,
  MatterAttorney,
  Task,
  Event,
  EventAttendee,
  Document,
  CostJournal,
  CostJournalApproval,
  Invoice,
  InvoiceBill,
  Deposit,
  PaymentProof,
  ActivityLog,
  ChatMessage,
  Hierarchy,
  DmMessage
};
