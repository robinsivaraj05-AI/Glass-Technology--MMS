import mongoose, { Schema } from 'mongoose';

const FollowupJobSchema = new Schema({
  followupId:       { type: String, default: '' },
  relatedJobId:     { type: String, default: '' },
  description:      { type: String, default: '' },
  nextFollowupDate: { type: String, default: '' },
  status:           { type: String, enum: ['Pending', 'In Progress', 'Completed', 'Cancelled'], default: 'Pending' },
  responsiblePerson:{ type: String, default: '' },
  comments:         { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('FollowupJob', FollowupJobSchema);
