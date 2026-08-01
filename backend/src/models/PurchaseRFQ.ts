import mongoose, { Schema, Document } from 'mongoose';

const RFQItemSchema = new Schema({
  slNo: { type: Number, default: 1 },
  category: { type: String, default: '' },
  description: { type: String, default: '' },
  make: { type: String, default: '' },
  quantity: { type: Number, default: 1 },
  unit: { type: String, default: 'No' },
  criticalRemarks: { type: String, default: '' },
}, { _id: false });

const PurchaseRFQSchema = new Schema({
  rfqNo: { type: String, required: true },
  date: { type: String, default: '' },
  subject: { type: String, default: '' },
  from: { type: String, default: '' },
  contactPerson: { type: String, default: '' },
  contactEmail: { type: String, default: '' },
  contactPhone: { type: String, default: '' },
  purposeOfRFQ: { type: String, default: '' },
  scopeOfWork: { type: String, default: '' },
  vendors: { type: String, default: '' },
  estimatedBudget: { type: Number, default: 0 },
  requiredBy: { type: String, default: '' },
  submissionDeadline: { type: String, default: '' },
  items: { type: [RFQItemSchema], default: [] },
  status: { type: String, enum: ['draft', 'sent', 'quotation-received', 'converted-to-po', 'closed'], default: 'draft' },
  quotationRef: { type: String, default: '' },
  poRef: { type: String, default: '' },
  remarks: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('PurchaseRFQ', PurchaseRFQSchema);
