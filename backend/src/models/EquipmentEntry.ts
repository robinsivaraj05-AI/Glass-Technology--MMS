import mongoose, { Schema, Document } from 'mongoose';

export interface IEquipmentEntry extends Document {
  equipmentId: mongoose.Types.ObjectId;
  equipmentName: string;
  equipmentType: string;
  vendorCompany: string;
  workDate: Date;
  poNumber: string;
  department: string;
  area: string;
  shift: string;
  operatorName: string;
  startTime: string;
  endTime: string;
  workingHours: number;
  overtimeHours: number;
  otRatePercent: number;
  workDescription: string;
  maintenanceType: string;
  rateType: 'Daily' | 'Hourly' | 'Monthly';
  rate: number;
  regularCost: number;
  otCost: number;
  totalCost: number;
  completionStatus: 'Completed' | 'In Progress' | 'Pending';
  approvedBy: string;
  supervisorName: string;
  remarks: string;
}

const EquipmentEntrySchema = new Schema<IEquipmentEntry>({
  equipmentId:      { type: Schema.Types.ObjectId, ref: 'Equipment' },
  equipmentName:    { type: String, required: true },
  equipmentType:    { type: String, default: '' },
  vendorCompany:    { type: String, default: '' },
  workDate:         { type: Date, required: true },
  poNumber:         { type: String, default: '' },
  department:       { type: String, default: 'E&I' },
  area:             { type: String, default: '' },
  shift:            { type: String, default: 'General' },
  operatorName:     { type: String, default: '' },
  startTime:        { type: String, default: '' },
  endTime:          { type: String, default: '' },
  workingHours:     { type: Number, default: 8 },
  overtimeHours:    { type: Number, default: 0 },
  otRatePercent:    { type: Number, default: 125 },
  workDescription:  { type: String, default: '' },
  maintenanceType:  { type: String, default: 'Preventive' },
  rateType:         { type: String, enum: ['Daily', 'Hourly', 'Monthly'], default: 'Daily' },
  rate:             { type: Number, default: 0 },
  regularCost:      { type: Number, default: 0 },
  otCost:           { type: Number, default: 0 },
  totalCost:        { type: Number, default: 0 },
  completionStatus: { type: String, enum: ['Completed', 'In Progress', 'Pending'], default: 'Completed' },
  approvedBy:       { type: String, default: '' },
  supervisorName:   { type: String, default: '' },
  remarks:          { type: String, default: '' },
}, { timestamps: true });

EquipmentEntrySchema.index({ workDate: -1 });
EquipmentEntrySchema.index({ equipmentId: 1, workDate: -1 });

export default mongoose.model<IEquipmentEntry>('EquipmentEntry', EquipmentEntrySchema);
