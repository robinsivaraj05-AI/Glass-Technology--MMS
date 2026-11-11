import mongoose, { Schema, Document } from 'mongoose';

export interface IQualityDocumentRevision extends Document {
  documentId: mongoose.Types.ObjectId;
  recordNo: string;
  revision: string;
  title: string;
  department: string;
  standard: string;
  clauses: string[];
  documentType: string;
  equipment: string;
  issueDate?: Date;
  reviewDate?: Date;
  owner: string;
  fileName: string;
  mimeType: string;
  fileDataBase64: string;
  archivedBy: string;
  archivedAt: Date;
  changeSummary: string;
}

const QualityDocumentRevisionSchema = new Schema<IQualityDocumentRevision>({
  documentId: { type: Schema.Types.ObjectId, ref: 'QualityRecord', required: true, index: true },
  recordNo: { type: String, required: true, index: true },
  revision: { type: String, required: true },
  title: { type: String, required: true },
  department: { type: String, default: '' },
  standard: { type: String, default: '' },
  clauses: { type: [String], default: [] },
  documentType: { type: String, default: '' },
  equipment: { type: String, default: '' },
  issueDate: { type: Date, default: null },
  reviewDate: { type: Date, default: null },
  owner: { type: String, default: '' },
  fileName: { type: String, default: '' },
  mimeType: { type: String, default: '' },
  fileDataBase64: { type: String, default: '', select: false },
  archivedBy: { type: String, required: true },
  archivedAt: { type: Date, default: Date.now },
  changeSummary: { type: String, required: true },
}, { timestamps: true });

QualityDocumentRevisionSchema.index({ documentId: 1, revision: 1 }, { unique: true });
export default mongoose.model<IQualityDocumentRevision>('QualityDocumentRevision', QualityDocumentRevisionSchema);
