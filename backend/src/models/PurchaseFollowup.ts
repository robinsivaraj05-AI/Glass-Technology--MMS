import mongoose, { Schema } from 'mongoose';

const PaymentTransactionSchema = new Schema({
  date: { type: String, default: '' },
  amount: { type: Number, default: 0 },
  remarks: { type: String, default: '' },
}, { _id: true });

// One entry per change of currentStatus, written by the server with the change date
const StatusChangeSchema = new Schema({
  status: { type: String, default: '' },
  from:   { type: String, default: '' },
  at:     { type: Date, default: Date.now },
  edited: { type: Boolean, default: false },   // date entered / corrected by a user
}, { _id: false });

const PurchaseFollowupSchema = new Schema({
  section: { type: String, default: '' },
  itemDescription: { type: String, default: '' },
  requestDate: { type: String, default: '' },
  requiredTimeline: { type: String, default: '' },
  currentStatus: { type: String, default: '' },
  paymentStatus: { type: String, default: '' },
  prNumber: { type: String, default: '' },
  reqDate: { type: String, default: '' },
  budget: { type: Number, default: 0 },
  leadTime: { type: String, default: '' },
  workingTime: { type: String, default: '' },
  source: { type: String, enum: ['manual', 'rfq', 'po'], default: 'manual' },
  remarks: { type: String, default: '' },
  receivedDate: { type: String, default: '' },
  paymentHistory: { type: [PaymentTransactionSchema], default: [] },
  statusHistory: { type: [StatusChangeSchema], default: [] },
}, { timestamps: true });

export default mongoose.model('PurchaseFollowup', PurchaseFollowupSchema);
