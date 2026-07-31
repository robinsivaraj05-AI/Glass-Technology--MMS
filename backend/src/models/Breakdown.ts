import mongoose, { Schema, Document } from 'mongoose';

export interface IBreakdown extends Document {
  ticketNo: string;
  machineId: mongoose.Types.ObjectId;
  machineName: string;
  reportedAt: Date;
  resolvedAt?: Date;
  problem: string;
  rootCause?: string;
  actionTaken?: string;
  downtime: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  reportedBy: string;
  assignedTo?: string;
  sparesUsed?: string[];
  cost?: number;
  photos?: string[];
}

const BreakdownSchema = new Schema<IBreakdown>({
  ticketNo: { type: String, required: true, unique: true },
  machineId: { type: Schema.Types.ObjectId, ref: 'Machine' },
  machineName: { type: String, required: true },
  reportedAt: { type: Date, default: Date.now },
  resolvedAt: Date,
  problem: { type: String, required: true },
  rootCause: String,
  actionTaken: String,
  downtime: { type: Number, default: 0 },
  priority: { type: String, enum: ['critical', 'high', 'medium', 'low'], default: 'medium' },
  status: { type: String, enum: ['open', 'in-progress', 'resolved', 'closed'], default: 'open' },
  reportedBy: { type: String, required: true },
  assignedTo: String,
  sparesUsed: [String],
  cost: Number,
  photos: [String],
}, { timestamps: true });

BreakdownSchema.pre('save', function (next) {
  if (!this.ticketNo) {
    const year = new Date().getFullYear();
    this.ticketNo = `BRK-${year}-${Math.floor(Math.random() * 9000) + 1000}`;
  }
  next();
});

export default mongoose.model<IBreakdown>('Breakdown', BreakdownSchema);
