import mongoose, { Schema } from 'mongoose';

// Who changed what, in which module. Entries are removed automatically after 31 days.
const ActivityLogSchema = new Schema({
  at:       { type: Date, default: Date.now },
  userId:   { type: String, default: '' },
  userName: { type: String, default: '' },
  role:     { type: String, default: '' },
  module:   { type: String, default: '' },
  action:   { type: String, default: '' },   // Created / Updated / Deleted / Login / Password changed …
  item:     { type: String, default: '' },   // what was changed (job, item description, name …)
  details:  { type: String, default: '' },   // changed fields and new values
  path:     { type: String, default: '' },
  method:   { type: String, default: '' },
});
ActivityLogSchema.index({ at: 1 }, { expireAfterSeconds: 31 * 24 * 3600 });
ActivityLogSchema.index({ module: 1, at: -1 });

export default mongoose.model('ActivityLog', ActivityLogSchema);
