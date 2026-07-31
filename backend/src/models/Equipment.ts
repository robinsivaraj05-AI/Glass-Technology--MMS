import mongoose, { Schema, Document } from 'mongoose';

export interface IEquipment extends Document {
  equipmentName: string;
  equipmentType: string;
  make: string;
  modelSpec: string;
  capacity: string;
  regNumber: string;
  vendorCompany: string;
  contactPerson: string;
  contactPhone: string;
  contractRef: string;
  rateType: 'Daily' | 'Hourly' | 'Monthly';
  rate: number;
  status: 'Active' | 'Inactive' | 'Under Maintenance';
  remarks: string;
}

const EquipmentSchema = new Schema<IEquipment>({
  equipmentName:  { type: String, required: true },
  equipmentType:  { type: String, default: 'Other' },
  make:           { type: String, default: '' },
  modelSpec:      { type: String, default: '' },
  capacity:       { type: String, default: '' },
  regNumber:      { type: String, default: '' },
  vendorCompany:  { type: String, required: true },
  contactPerson:  { type: String, default: '' },
  contactPhone:   { type: String, default: '' },
  contractRef:    { type: String, default: '' },
  rateType:       { type: String, enum: ['Daily', 'Hourly', 'Monthly'], default: 'Daily' },
  rate:           { type: Number, default: 0 },
  status:         { type: String, enum: ['Active', 'Inactive', 'Under Maintenance'], default: 'Active' },
  remarks:        { type: String, default: '' },
}, { timestamps: true });

EquipmentSchema.index({ vendorCompany: 1 });
EquipmentSchema.index({ status: 1 });

export default mongoose.model<IEquipment>('Equipment', EquipmentSchema);
