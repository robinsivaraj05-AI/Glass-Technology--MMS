import mongoose, { Schema } from 'mongoose';

const ReportLogSchema = new Schema({
  year:   { type: Number, required: true },
  month:  { type: Number, required: true },
  sentAt: { type: Date, default: Date.now },
  to:     { type: String, default: '' },
}, { timestamps: false });

ReportLogSchema.index({ year: 1, month: 1 }, { unique: true });

export default mongoose.model('ReportLog', ReportLogSchema);
