import mongoose, { Schema, Document } from 'mongoose';

export interface IOvertime extends Document {
  empId: string; empName: string;
  year: number; month: number; day: number;
  startTime: string; endTime: string;
  totalHours: number;
  reason: string; approvedBy: string;
}

const OvertimeSchema = new Schema({
  empId:      { type: String, required: true },
  empName:    { type: String, required: true },
  year:       { type: Number, required: true },
  month:      { type: Number, required: true },
  day:        { type: Number, required: true },
  startTime:  { type: String, required: true },
  endTime:    { type: String, required: true },
  totalHours: { type: Number, required: true },
  reason:     { type: String, default: '' },
  approvedBy: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model<IOvertime>('Overtime', OvertimeSchema);
