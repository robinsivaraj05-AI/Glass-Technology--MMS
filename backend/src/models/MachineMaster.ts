import mongoose, { Schema } from 'mongoose';

const MachineMasterSchema = new Schema({
  machineId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  category: { type: String, default: '' },
  location: { type: String, default: '' },
  department: { type: String, default: '' },
  manufacturer: { type: String, default: '' },
  model: { type: String, default: '' },
  serialNo: { type: String, default: '' },
  installDate: { type: String, default: '' },
  capacity: { type: String, default: '' },
  voltage: { type: String, default: '' },
  current: { type: String, default: '' },
  speed: { type: String, default: '' },
  driveType: { type: String, default: '' },
  plcTag: { type: String, default: '' },
  controlPanel: { type: String, default: '' },
  lastPM: { type: String, default: '' },
  nextPM: { type: String, default: '' },
  pmFrequency: { type: String, default: '' },
  criticality: { type: String, enum: ['critical', 'high', 'medium', 'low'], default: 'medium' },
  status: { type: String, enum: ['running', 'stopped', 'under-maintenance', 'breakdown'], default: 'running' },
  drawingNo: { type: String, default: '' },
  remarks: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('MachineMaster', MachineMasterSchema);
