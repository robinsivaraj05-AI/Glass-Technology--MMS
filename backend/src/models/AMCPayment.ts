import mongoose, { Schema, Document } from 'mongoose';

export interface IAMCPayment extends Document {
  amcId: mongoose.Types.ObjectId;
  amcNumber: string;
  equipmentName: string;
  contractorCompany: string;
  invoiceNumber: string;
  invoiceDate: Date;
  invoiceAmount: number;
  paidAmount: number;
  balance: number;
  paymentDate?: Date;
  paymentStatus: string;
  remarks: string;
}

const AMCPaymentSchema = new Schema<IAMCPayment>(
  {
    amcId:             { type: Schema.Types.ObjectId, ref: 'AMCMaster', required: true },
    amcNumber:         { type: String, required: true },
    equipmentName:     { type: String, default: '' },
    contractorCompany: { type: String, default: '' },
    invoiceNumber:     { type: String, default: '' },
    invoiceDate:       { type: Date, required: true },
    invoiceAmount:     { type: Number, default: 0 },
    paidAmount:        { type: Number, default: 0 },
    balance:           { type: Number, default: 0 },
    paymentDate:       { type: Date },
    paymentStatus:     { type: String, enum: ['Advance', 'Partially Paid', 'Paid', 'Overdue'], default: 'Overdue' },
    remarks:           { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model<IAMCPayment>('AMCPayment', AMCPaymentSchema);
