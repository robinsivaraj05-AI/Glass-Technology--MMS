import mongoose, { Schema } from 'mongoose';

const PaymentTransactionSchema = new Schema({
  date: { type: String, default: '' },
  amount: { type: Number, default: 0 },
  remarks: { type: String, default: '' },
}, { _id: true });

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
}, { timestamps: true });

export default mongoose.model('PurchaseFollowup', PurchaseFollowupSchema);
