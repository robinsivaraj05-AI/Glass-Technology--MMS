import mongoose, { Schema } from 'mongoose';

const ReminderSchema = new Schema({
  title:        { type: String, default: '' },
  description:  { type: String, default: '' },
  dueDate:      { type: String, default: '' },
  frequency:    { type: String, enum: ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'], default: 'Monthly' },
  priority:     { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
  assignedUser: { type: String, default: '' },
  status:       { type: String, enum: ['Pending', 'Completed', 'Overdue'], default: 'Pending' },
}, { timestamps: true });

export default mongoose.model('Reminder', ReminderSchema);
