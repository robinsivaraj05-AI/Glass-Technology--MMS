import mongoose, { Schema, Document } from 'mongoose';

export interface IAMCSchedule extends Document {
  amcId: mongoose.Types.ObjectId;
  amcNumber: string;
  equipmentName: string;
  department: string;
  contractorCompany: string;
  visitNumber: number;
  scheduledDate: Date;
  status: string;
  completionDate?: Date;
  engineerName: string;
  workDone: string;
  observations: string;
  partsReplaced: string;
  recommendations: string;
}

const AMCScheduleSchema = new Schema<IAMCSchedule>(
  {
    amcId:             { type: Schema.Types.ObjectId, ref: 'AMCMaster', required: true },
    amcNumber:         { type: String, required: true },
    equipmentName:     { type: String, default: '' },
    department:        { type: String, default: '' },
    contractorCompany: { type: String, default: '' },
    visitNumber:       { type: Number, required: true },
    scheduledDate:     { type: Date, required: true },
    status:            { type: String, enum: ['Scheduled', 'Completed', 'Overdue', 'Cancelled'], default: 'Scheduled' },
    completionDate:    { type: Date },
    engineerName:      { type: String, default: '' },
    workDone:          { type: String, default: '' },
    observations:      { type: String, default: '' },
    partsReplaced:     { type: String, default: '' },
    recommendations:   { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model<IAMCSchedule>('AMCSchedule', AMCScheduleSchema);
