import mongoose, { Schema, Document } from 'mongoose';

export interface IOrgPosition extends Document {
  posId:             string;
  parentId:          string | null;
  role:              string;
  team:              string;
  department:        string;
  personName:        string;
  linkedEmpId:       string;
  urgent:            boolean;
  sortOrder:         number;
  roleCategory:      string;   // grouping label for the stats table
  recruitmentStatus: string;   // joined | ready_to_join | hr_process | pending
}

const OrgPositionSchema = new Schema<IOrgPosition>({
  posId:             { type: String, required: true, unique: true },
  parentId:          { type: String, default: null },
  role:              { type: String, required: true },
  team:              { type: String, default: '' },
  department:        { type: String, default: 'Electrical & Instrumentation' },
  personName:        { type: String, default: '' },
  linkedEmpId:       { type: String, default: '' },
  urgent:            { type: Boolean, default: false },
  sortOrder:         { type: Number, default: 0 },
  roleCategory:      { type: String, default: '' },
  recruitmentStatus: { type: String, default: 'pending' },
}, { timestamps: true });

export default mongoose.model<IOrgPosition>('OrgPosition', OrgPositionSchema);
