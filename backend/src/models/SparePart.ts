import mongoose, { Schema, Document } from 'mongoose';

export interface ISparePart extends Document {
  spareCode: string;
  itemName: string;
  category: string;
  storeName: 'Main Store' | 'E&I Store' | 'IT Store' | 'Other Stores';
  unit: string;
  openingStock: number;
  receivedQty: number;
  issuedQty: number;
  currentStock: number;
  unitPrice: number;
  totalValue: number;
  purchaseDate?: Date;
  supplier: string;
  location: string;
  minStock: number;
  criticalLevel: number;
  isCritical: boolean;
  remarks: string;
}

const SparePartSchema = new Schema<ISparePart>({
  spareCode:     { type: String, required: true, unique: true, trim: true },
  itemName:      { type: String, required: true, trim: true },
  category:      { type: String, default: 'General', trim: true },
  storeName:     { type: String, enum: ['Main Store', 'E&I Store', 'IT Store', 'Other Stores'], default: 'Main Store' },
  unit:          { type: String, default: 'Nos' },
  openingStock:  { type: Number, default: 0 },
  receivedQty:   { type: Number, default: 0 },
  issuedQty:     { type: Number, default: 0 },
  currentStock:  { type: Number, default: 0 },
  unitPrice:     { type: Number, default: 0 },
  totalValue:    { type: Number, default: 0 },
  purchaseDate:  { type: Date },
  supplier:      { type: String, default: '' },
  location:      { type: String, default: '' },
  minStock:      { type: Number, default: 0 },
  criticalLevel: { type: Number, default: 0 },
  isCritical:    { type: Boolean, default: false },
  remarks:       { type: String, default: '' },
}, { timestamps: true });

SparePartSchema.index({ spareCode: 1 });
SparePartSchema.index({ storeName: 1 });
SparePartSchema.index({ category: 1 });

export default mongoose.model<ISparePart>('SparePart', SparePartSchema);
