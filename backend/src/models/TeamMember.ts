import mongoose, { Schema, Document } from 'mongoose';

export interface ITeamMember extends Document {
  empId: string; empName: string; role: string; sortOrder: number;
}

const TeamMemberSchema = new Schema({
  empId:     { type: String, required: true, unique: true },
  empName:   { type: String, required: true },
  role:      { type: String, required: true },
  sortOrder: { type: Number, required: true },
}, { timestamps: true });

export default mongoose.model<ITeamMember>('TeamMember', TeamMemberSchema);
