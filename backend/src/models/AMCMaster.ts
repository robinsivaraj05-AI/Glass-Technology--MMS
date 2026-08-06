import mongoose, { Schema, Document } from 'mongoose';

export interface IAMCMaster extends Document {
  amcNumber: string;
  department: string;
  area: string;
  equipmentCategory: string;
  equipmentName: string;
  equipmentCode: string;
  manufacturer: string;
  modelNumber: string;
  serialNumber: string;
  assetId: string;
  amcType: string;
  frequency: string;
  customIntervalDays: number;
  visitsPerYear: number;
  startDate: Date;
  endDate: Date;
  autoRenewal: boolean;
  gracePeriodDays: number;
  criticality: string;
  status: string;
  contractorCompany: string;
  contactPerson: string;
  mobile: string;
  email: string;
  address: string;
  tradeLicense: string;
  trnNumber: string;
  contractNumber: string;
  poNumber: string;
  agreementNumber: string;
  invoiceNumber: string;
  currency: string;
  contractValue: number;
  vatPercent: number;
  vatAmount: number;
  totalContractValue: number;
  paymentTerms: string;
  remarks: string;
  documents: Array<{ name: string; type: string; dataUrl: string; uploadDate: Date }>;
  lastServiceDate?: Date;
  nextDueDate?: Date;
  completedVisits: number;
}

const DocumentSchema = new Schema(
  { name: String, type: String, dataUrl: String, uploadDate: { type: Date, default: Date.now } },
  { _id: false }
);

const AMCMasterSchema = new Schema<IAMCMaster>(
  {
    amcNumber:          { type: String, required: true, unique: true },
    department:         { type: String, default: '' },
    area:               { type: String, default: '' },
    equipmentCategory:  { type: String, default: '' },
    equipmentName:      { type: String, required: true },
    equipmentCode:      { type: String, default: '' },
    manufacturer:       { type: String, default: '' },
    modelNumber:        { type: String, default: '' },
    serialNumber:       { type: String, default: '' },
    assetId:            { type: String, default: '' },
    amcType:            { type: String, default: 'Service Contract' },
    frequency:          { type: String, default: 'Yearly' },
    customIntervalDays: { type: Number, default: 0 },
    visitsPerYear:      { type: Number, default: 1 },
    startDate:          { type: Date, required: true },
    endDate:            { type: Date, required: true },
    autoRenewal:        { type: Boolean, default: false },
    gracePeriodDays:    { type: Number, default: 30 },
    criticality:        { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
    status:             { type: String, enum: ['Active', 'Expired', 'Pending Renewal', 'Cancelled'], default: 'Active' },
    contractorCompany:  { type: String, default: '' },
    contactPerson:      { type: String, default: '' },
    mobile:             { type: String, default: '' },
    email:              { type: String, default: '' },
    address:            { type: String, default: '' },
    tradeLicense:       { type: String, default: '' },
    trnNumber:          { type: String, default: '' },
    contractNumber:     { type: String, default: '' },
    poNumber:           { type: String, default: '' },
    agreementNumber:    { type: String, default: '' },
    invoiceNumber:      { type: String, default: '' },
    currency:           { type: String, default: 'AED' },
    contractValue:      { type: Number, default: 0 },
    vatPercent:         { type: Number, default: 5 },
    vatAmount:          { type: Number, default: 0 },
    totalContractValue: { type: Number, default: 0 },
    paymentTerms:       { type: String, default: 'Yearly' },
    remarks:            { type: String, default: '' },
    documents:          { type: [DocumentSchema], default: [] },
    lastServiceDate:    { type: Date },
    nextDueDate:        { type: Date },
    completedVisits:    { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model<IAMCMaster>('AMCMaster', AMCMasterSchema);
