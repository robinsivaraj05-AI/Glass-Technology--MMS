import mongoose, { Schema, Document } from 'mongoose';

export interface IEntry { day: number; code: string; remark?: string; }

export interface IAttendanceRecord extends Document {
  empId: string;
  empName: string;
  year: number;
  month: number;
  entries: IEntry[];
}

const AttendanceSchema = new Schema({
  empId:   { type: String, required: true },
  empName: { type: String, required: true },
  year:    { type: Number, required: true },
  month:   { type: Number, required: true },
  entries: [{ day: Number, code: String, remark: { type: String, default: '' }, _id: false }],
}, { timestamps: true });

AttendanceSchema.index({ empId: 1, year: 1, month: 1 }, { unique: true });

export default mongoose.model<IAttendanceRecord>('AttendanceRecord', AttendanceSchema);
