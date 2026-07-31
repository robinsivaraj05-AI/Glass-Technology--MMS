import mongoose, { Schema } from 'mongoose';

const POItemSchema = new Schema({
  slNo: { type: Number, default: 1 },
  tagNo: { type: String, default: '' },
  description: { type: String, default: '' },
  specification: { type: String, default: '' },
  make: { type: String, default: '' },
  qty: { type: Number, default: 1 },
  unit: { type: String, default: 'Nos' },
  unitPrice: { type: Number, default: 0 },
  totalPrice: { type: Number, default: 0 },
  receivedQty: { type: Number, default: 0 },
}, { _id: false });

const PurchasePOSchema = new Schema({
  poNo: { type: String, required: true },
  poDate: { type: String, default: '' },
  rfqRef: { type: String, default: '' },
  vendor: { type: String, default: '' },
  vendorContact: { type: String, default: '' },
  department: { type: String, default: '' },
  requestedBy: { type: String, default: '' },
  approvedBy: { type: String, default: '' },
  estimatedDelivery: { type: String, default: '' },
  actualDelivery: { type: String, default: '' },
  items: { type: [POItemSchema], default: [] },
  totalValue: { type: Number, default: 0 },
  currency: { type: String, default: 'AED' },
  deliveryAddress: { type: String, default: '' },
  paymentTerms: { type: String, default: '' },
  status: { type: String, enum: ['ordered', 'acknowledged', 'in-transit', 'partially-received', 'received', 'delayed', 'cancelled'], default: 'ordered' },
  trackingRef: { type: String, default: '' },
  remarks: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('PurchasePO', PurchasePOSchema);
