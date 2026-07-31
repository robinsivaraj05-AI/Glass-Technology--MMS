import mongoose, { Schema } from 'mongoose';

const CalibrationSchema = new Schema({
  instrumentId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  location: { type: String, default: '' },
  type: { type: String, enum: ['Internal', 'External'], default: 'External' },
  vendor: { type: String, default: '' },
  lastDate: { type: String, default: '' },
  nextDate: { type: String, default: '' },
  status: { type: String, enum: ['due-soon', 'upcoming', 'overdue', 'completed'], default: 'upcoming' },
  certificate: { type: String, default: '' },
  range: { type: String, default: '' },
  accuracy: { type: String, default: '' },
  frequency: { type: String, default: 'Half Yearly' },
}, { timestamps: true });

export default mongoose.model('Calibration', CalibrationSchema);
