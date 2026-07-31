import mongoose, { Schema, Document } from 'mongoose';

export interface IWorkerItem {
  name: string;
  age: number;
  workerId: string;
  designation: string;
  workingHours: number;
  overtimeHours: number;
  rate: number;   // per-day rate; 0 = Nil (package)
  cost: number;   // computed: workingHours × rate (0 if package)
}

export interface IOutsourceEntry extends Document {
  contractId: mongoose.Types.ObjectId;
  contractName: string;
  contractorCompany: string;
  poNumber: string;
  workDate: Date;
  workers: IWorkerItem[];
  department: string;
  area: string;
  shift: string;
  workDescription: string;
  maintenanceType: string;
  numberOfPersons: number;
  costType: 'daily' | 'package';
  packageCost: number;
  totalCost: number;
  approvedBy: string;
  supervisorName: string;
  completionStatus: string;
  remarks: string;
  // OT Authorization
  otStartTime: string;
  otEndTime: string;
  otRatePercent: number;   // e.g. 125 = 1.25× OT rate
  otReason: string;
  otReasonDetails: string;
  otApprovedBy: string;
  otApprovalRef: string;
  // Legacy single-worker fields (kept for existing data backward compat)
  workerName?: string;
  workerAge?: number;
  workerId?: string;
  designation?: string;
  workingHours?: number;
  overtimeHours?: number;
  costPerPerson?: number;
}

const WorkerItemSchema = new Schema<IWorkerItem>({
  name:          { type: String, required: true },
  age:           { type: Number, default: 0 },
  workerId:      { type: String, default: '' },
  designation:   { type: String, default: '' },
  workingHours:  { type: Number, default: 8 },
  overtimeHours: { type: Number, default: 0 },
  rate:          { type: Number, default: 0 },   // flat day salary (AED/day)
  cost:          { type: Number, default: 0 },   // rate + (rate/8 × OT hrs × otRatePercent/100)
}, { _id: false });

const OutsourceEntrySchema = new Schema<IOutsourceEntry>({
  contractId:        { type: Schema.Types.ObjectId, ref: 'Contract' },
  contractName:      { type: String, required: true },
  contractorCompany: { type: String, required: true },
  poNumber:          { type: String, default: '' },
  workDate:          { type: Date, required: true },
  workers:           { type: [WorkerItemSchema], default: [] },
  department:        { type: String, default: 'E&I' },
  area:              { type: String, default: '' },
  shift:             { type: String, default: 'General' },
  workDescription:   { type: String, default: '' },
  maintenanceType:   { type: String, default: 'Preventive' },
  numberOfPersons:   { type: Number, default: 0 },
  costType:          { type: String, enum: ['daily', 'package'], default: 'daily' },
  packageCost:       { type: Number, default: 0 },
  totalCost:         { type: Number, default: 0 },
  approvedBy:        { type: String, default: '' },
  supervisorName:    { type: String, default: '' },
  completionStatus:  { type: String, enum: ['Completed', 'In Progress', 'Pending'], default: 'Completed' },
  remarks:           { type: String, default: '' },
  // OT Authorization
  otStartTime:       { type: String, default: '' },
  otEndTime:         { type: String, default: '' },
  otRatePercent:     { type: Number, default: 125 },
  otReason:          { type: String, default: '' },
  otReasonDetails:   { type: String, default: '' },
  otApprovedBy:      { type: String, default: '' },
  otApprovalRef:     { type: String, default: '' },
  // Legacy fields
  workerName:        { type: String },
  workerAge:         { type: Number },
  workerId:          { type: String },
  designation:       { type: String },
  workingHours:      { type: Number },
  overtimeHours:     { type: Number },
  costPerPerson:     { type: Number },
}, { timestamps: true });

OutsourceEntrySchema.index({ workDate: -1 });
OutsourceEntrySchema.index({ contractId: 1, workDate: -1 });

export default mongoose.model<IOutsourceEntry>('OutsourceEntry', OutsourceEntrySchema);
