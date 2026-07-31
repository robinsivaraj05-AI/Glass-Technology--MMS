import mongoose, { Schema, Document } from 'mongoose';

export interface IAccessoryItem {
  itemName: string;
  category: string;
  unit: string;
  quantity: number;
  unitRate: number;
  totalCost: number;
}

export interface IAccessoryEntry extends Document {
  entryDate: Date;
  equipmentId?: mongoose.Types.ObjectId;
  equipmentName: string;
  poNumber: string;
  department: string;
  area: string;
  items: IAccessoryItem[];
  totalCost: number;
  approvedBy: string;
  remarks: string;
}

const AccessoryItemSchema = new Schema<IAccessoryItem>({
  itemName:  { type: String, required: true },
  category:  { type: String, default: 'Other' },
  unit:      { type: String, default: 'Liters' },
  quantity:  { type: Number, default: 0 },
  unitRate:  { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 },
}, { _id: false });

const AccessoryEntrySchema = new Schema<IAccessoryEntry>({
  entryDate:     { type: Date, required: true },
  equipmentId:   { type: Schema.Types.ObjectId, ref: 'Equipment' },
  equipmentName: { type: String, default: '' },
  poNumber:      { type: String, default: '' },
  department:    { type: String, default: 'E&I' },
  area:          { type: String, default: '' },
  items:         { type: [AccessoryItemSchema], default: [] },
  totalCost:     { type: Number, default: 0 },
  approvedBy:    { type: String, default: '' },
  remarks:       { type: String, default: '' },
}, { timestamps: true });

AccessoryEntrySchema.index({ entryDate: -1 });

export default mongoose.model<IAccessoryEntry>('AccessoryEntry', AccessoryEntrySchema);
