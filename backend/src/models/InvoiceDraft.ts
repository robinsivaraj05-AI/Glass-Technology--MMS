import mongoose, { Schema, Document } from 'mongoose';

export type InvoiceDraftStatus = 'pending' | 'approved' | 'rejected';

export interface IExtractedInvoice {
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: Date | null;
  deliveryOrderNumber: string;
  poNumber: string;
  customerName: string;
  itemName: string;
  quantity: number | null;
  unit: string;
  unitRate: number | null;
  subtotal: number | null;
  vatPercent: number | null;
  vatAmount: number | null;
  grandTotal: number | null;
  currency: string;
  equipmentName: string;
  area: string;
  confidenceNotes: string[];
}

export interface IInvoiceDraft extends Document {
  originalFilename: string;
  mimeType: string;
  fileDataBase64: string;
  extracted: IExtractedInvoice;
  status: InvoiceDraftStatus;
  createdBy?: string;
  reviewedBy?: string;
  accessoryEntryId?: mongoose.Types.ObjectId;
  rejectionReason?: string;
}

const ExtractedSchema = new Schema({
  supplierName: { type: String, default: '' },
  invoiceNumber: { type: String, default: '' },
  invoiceDate: { type: Date, default: null },
  deliveryOrderNumber: { type: String, default: '' },
  poNumber: { type: String, default: '' },
  customerName: { type: String, default: '' },
  itemName: { type: String, default: '' },
  quantity: { type: Number, default: null },
  unit: { type: String, default: '' },
  unitRate: { type: Number, default: null },
  subtotal: { type: Number, default: null },
  vatPercent: { type: Number, default: null },
  vatAmount: { type: Number, default: null },
  grandTotal: { type: Number, default: null },
  currency: { type: String, default: 'AED' },
  equipmentName: { type: String, default: '' },
  area: { type: String, default: '' },
  confidenceNotes: { type: [String], default: [] },
}, { _id: false });

const InvoiceDraftSchema = new Schema<IInvoiceDraft>({
  originalFilename: { type: String, required: true },
  mimeType: { type: String, required: true },
  // Kept with the pending draft so the source document remains available for review.
  // Upload limit is intentionally small to stay below MongoDB's 16 MB document limit.
  fileDataBase64: { type: String, required: true, select: false },
  extracted: { type: ExtractedSchema, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  createdBy: { type: String, default: '' },
  reviewedBy: { type: String, default: '' },
  accessoryEntryId: { type: Schema.Types.ObjectId, ref: 'AccessoryEntry' },
  rejectionReason: { type: String, default: '' },
}, { timestamps: true });

InvoiceDraftSchema.index({ 'extracted.invoiceNumber': 1, 'extracted.deliveryOrderNumber': 1 });
export default mongoose.model<IInvoiceDraft>('InvoiceDraft', InvoiceDraftSchema);
