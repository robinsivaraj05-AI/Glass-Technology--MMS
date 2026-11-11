import mongoose, { Schema, Document } from 'mongoose';

export type QualityRecordType = 'document' | 'audit' | 'capa';
const ApprovalEventSchema = new Schema({
  action: { type: String, enum: ['Submitted','Reviewed','Approved','Rejected','Revision Created'], required: true },
  actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  actorName: { type: String, required: true },
  actorRole: { type: String, required: true },
  comments: { type: String, default: '' },
  revision: { type: String, default: '' },
  at: { type: Date, default: Date.now },
}, { _id: true });

export interface IQualityRecord extends Document {
  recordType: QualityRecordType; recordNo: string; title: string; department: string; standard: string;
  clauses: string[]; documentType: string; equipment: string; revision: string; issueDate?: Date; reviewDate?: Date;
  owner: string; preparedBy: string; reviewedBy: string; approvedBy: string; status: string;
  fileName: string; mimeType: string; fileDataBase64: string;
  approvalHistory: any[]; changeSummary: string;
  auditType: string; auditDate?: Date; auditor: string; findingType: string; finding: string;
  rootCause: string; correction: string; correctiveAction: string; responsible: string; targetDate?: Date;
  evidence: string; verifiedBy: string; verifiedDate?: Date; effectivenessResult: string; closureDate?: Date;
}

const QualityRecordSchema = new Schema<IQualityRecord>({
  recordType: { type: String, enum: ['document', 'audit', 'capa'], required: true, index: true },
  recordNo: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true },
  department: { type: String, default: 'E&I', index: true },
  standard: { type: String, default: '' }, clauses: { type: [String], default: [] },
  documentType: { type: String, default: '' }, equipment: { type: String, default: '' },
  revision: { type: String, default: '00' }, issueDate: { type: Date, default: null },
  reviewDate: { type: Date, default: null }, owner: { type: String, default: '' },
  preparedBy: { type: String, default: '' }, reviewedBy: { type: String, default: '' },
  approvedBy: { type: String, default: '' }, status: { type: String, default: 'Draft', index: true },
  fileName: { type: String, default: '' }, mimeType: { type: String, default: '' },
  fileDataBase64: { type: String, default: '', select: false },
  approvalHistory: { type: [ApprovalEventSchema], default: [] },
  changeSummary: { type: String, default: '' },
  auditType: { type: String, default: '' }, auditDate: { type: Date, default: null },
  auditor: { type: String, default: '' }, findingType: { type: String, default: '' },
  finding: { type: String, default: '' }, rootCause: { type: String, default: '' },
  correction: { type: String, default: '' }, correctiveAction: { type: String, default: '' },
  responsible: { type: String, default: '' }, targetDate: { type: Date, default: null },
  evidence: { type: String, default: '' }, verifiedBy: { type: String, default: '' },
  verifiedDate: { type: Date, default: null }, effectivenessResult: { type: String, default: '' },
  closureDate: { type: Date, default: null },
}, { timestamps: true });

QualityRecordSchema.index({ recordType: 1, recordNo: 1 }, { unique: true });
QualityRecordSchema.index({ department: 1, reviewDate: 1, targetDate: 1 });
export default mongoose.model<IQualityRecord>('QualityRecord', QualityRecordSchema);
