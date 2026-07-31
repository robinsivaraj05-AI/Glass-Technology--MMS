import mongoose, { Schema, Document } from 'mongoose';

export interface IContract extends Document {
  contractName: string;
  contractorCompany: string;
  contractNumber: string;
  poNumber: string;
  startDate: Date;
  endDate: Date;
  contractType: string;
  paymentTerms: string;
  scopeOfWork: string;
  contractValue: number;
  contactPerson: string;
  mobile: string;
  email: string;
  status: 'Active' | 'Expired' | 'Closed';
}

const ContractSchema = new Schema<IContract>({
  contractName:      { type: String, required: true },
  contractorCompany: { type: String, required: true },
  contractNumber:    { type: String, required: true, unique: true },
  poNumber:          { type: String, default: '' },
  startDate:         { type: Date, required: true },
  endDate:           { type: Date, required: true },
  contractType:      { type: String, required: true },
  paymentTerms:      { type: String, enum: ['Daily', 'Monthly', 'Weekly', 'AMC', 'Quarterly'], default: 'Monthly' },
  scopeOfWork:       { type: String, default: '' },
  contractValue:     { type: Number, default: 0 },
  contactPerson:     { type: String, default: '' },
  mobile:            { type: String, default: '' },
  email:             { type: String, default: '' },
  status:            { type: String, enum: ['Active', 'Expired', 'Closed'], default: 'Active' },
}, { timestamps: true });

export default mongoose.model<IContract>('Contract', ContractSchema);
