import mongoose, { Schema } from 'mongoose';

const PendingJobSchema = new Schema({
  jobId:       { type: String, default: '' },
  asset:       { type: String, default: '' },
  description: { type: String, default: '' },
  priority:    { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
  assignedTo:  { type: String, default: '' },
  createdDate: { type: String, default: '' },
  dueDate:     { type: String, default: '' },
  status:      { type: String, enum: ['Open', 'In Progress', 'On Hold', 'Completed', 'Cancelled'], default: 'Open' },
  remarks:       { type: String, default: '' },
  completedBy:   { type: String, default: '' },
  completedDate: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('PendingJob', PendingJobSchema);
