import mongoose, { Schema, Document } from 'mongoose';

export interface IAMCBudget extends Document {
  budgetYear: number;
  department: string;
  category: string;
  allocatedBudget: number;
  actualSpent: number;
}

const AMCBudgetSchema = new Schema<IAMCBudget>(
  {
    budgetYear:      { type: Number, required: true },
    department:      { type: String, required: true },
    category:        { type: String, default: '' },
    allocatedBudget: { type: Number, default: 0 },
    actualSpent:     { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model<IAMCBudget>('AMCBudget', AMCBudgetSchema);
