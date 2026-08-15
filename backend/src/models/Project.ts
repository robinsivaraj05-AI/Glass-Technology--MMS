import mongoose, { Schema, Document } from 'mongoose';

export interface IProject extends Document {
  projectNo: string;
  name: string;
  type: string;
  status: string;
  priority: string;
  budget: number;
  spent: number;
  progress: number;
  startDate: string;
  endDate: string;
  projectManager: string;
  teamMembers: string[];
  description: string;
}

const ProjectSchema = new Schema<IProject>({
  projectNo:      { type: String, required: true, unique: true },
  name:           { type: String, required: true },
  type:           { type: String, default: 'electrical' },
  status:         { type: String, default: 'planning' },
  priority:       { type: String, default: 'high' },
  budget:         { type: Number, default: 0 },
  spent:          { type: Number, default: 0 },
  progress:       { type: Number, default: 0 },
  startDate:      { type: String, default: '' },
  endDate:        { type: String, default: '' },
  projectManager: { type: String, default: '' },
  teamMembers:    { type: [String], default: [] },
  description:    { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model<IProject>('Project', ProjectSchema);
