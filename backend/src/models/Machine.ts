import mongoose, { Schema, Document } from 'mongoose';

export interface IMachine extends Document {
  code: string;
  name: string;
  department: string;
  location: string;
  manufacturer: string;
  serialNumber: string;
  installationDate: Date;
  criticality: 'critical' | 'high' | 'medium' | 'low';
  status: 'running' | 'breakdown' | 'maintenance' | 'idle';
  availability: number;
  plcDetails?: string;
  driveDetails?: string;
  motorDetails?: string;
  sensorDetails?: string;
  maintenanceFrequency?: string;
  warranty?: string;
  photo?: string;
}

const MachineSchema = new Schema<IMachine>({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  department: { type: String, required: true },
  location: { type: String, required: true },
  manufacturer: String,
  serialNumber: String,
  installationDate: Date,
  criticality: { type: String, enum: ['critical', 'high', 'medium', 'low'], default: 'medium' },
  status: { type: String, enum: ['running', 'breakdown', 'maintenance', 'idle'], default: 'running' },
  availability: { type: Number, default: 100 },
  plcDetails: String,
  driveDetails: String,
  motorDetails: String,
  sensorDetails: String,
  maintenanceFrequency: String,
  warranty: String,
  photo: String,
}, { timestamps: true });

export default mongoose.model<IMachine>('Machine', MachineSchema);
