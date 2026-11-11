import { Router } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import QualityRecord from '../models/QualityRecord';
import QualityDocumentRevision from '../models/QualityDocumentRevision';
import User from '../models/User';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv','image/jpeg','image/png','image/webp'];
    if (!allowed.includes(file.mimetype)) return cb(new Error('File type not allowed. Upload PDF, Word, Excel, CSV or image files.'));
    cb(null, true);
  },
});
router.use(authenticate);
const safeQuery = (query: any) => query.select('-fileDataBase64');
const actor = async (req: any) => {
  const user = await User.findById(req.user.id).select('name role');
  if (!user) throw new Error('Authenticated user record not found.');
  return { id: user._id, name: user.name, role: user.role };
};
const validId = (id: string) => mongoose.isValidObjectId(id);
const docFields = ['title','department','standard','clauses','documentType','equipment','reviewDate','owner'];

router.get('/summary', async (_req, res) => {
  const [documents, audits, capas, dueDocuments, overdueCapas] = await Promise.all([
    QualityRecord.countDocuments({ recordType: 'document' }),
    QualityRecord.countDocuments({ recordType: 'audit' }),
    QualityRecord.countDocuments({ recordType: 'capa', status: { $ne: 'Closed' } }),
    QualityRecord.countDocuments({ recordType: 'document', reviewDate: { $lte: new Date() }, status: { $nin: ['Obsolete','Superseded'] } }),
    QualityRecord.countDocuments({ recordType: 'capa', targetDate: { $lt: new Date() }, status: { $ne: 'Closed' } }),
  ]);
  res.json({ documents, audits, openCapas: capas, dueDocuments, overdueCapas });
});

router.get('/documents', async (_req, res) => {
  const records = await safeQuery(QualityRecord.find({ recordType: 'document' }).sort({ updatedAt: -1 }));
  res.json({ records });
});
router.post('/documents', authorize('manager','deputy_manager','shift_engineer'), upload.single('file'), async (req: any, res) => {
  try {
    const { recordNo, title, department, standard, clauses, documentType, equipment, revision, issueDate, reviewDate, owner } = req.body;
    if (!recordNo?.trim() || !title?.trim()) return res.status(400).json({ message: 'Document number and title are required.' });
    const who = await actor(req);
    const payload: any = {
      recordType: 'document', recordNo: recordNo.trim(), title: title.trim(), department: department || 'E&I',
      standard: standard || '', clauses: clauses ? String(clauses).split(',').map((x: string) => x.trim()).filter(Boolean) : [],
      documentType: documentType || 'Record', equipment: equipment || '', revision: revision || '00',
      issueDate: issueDate || null, reviewDate: reviewDate || null, owner: owner || who.name,
      preparedBy: who.name, status: 'Draft',
    };
    if (req.file) { payload.fileName = req.file.originalname; payload.mimeType = req.file.mimetype; payload.fileDataBase64 = req.file.buffer.toString('base64'); }
    const record = await QualityRecord.create(payload);
    res.status(201).json({ record: record.toObject() });
  } catch (err: any) {
    if (err?.code === 11000) return res.status(409).json({ message: 'This document number already exists.' });
    res.status(400).json({ message: err.message || 'Could not save document.' });
  }
});
router.get('/documents/:id/history', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid document ID.' });
  const record = await QualityRecord.findOne({ _id: req.params.id, recordType: 'document' }).select('approvalHistory recordNo revision status');
  if (!record) return res.status(404).json({ message: 'Document not found.' });
  const revisions = await QualityDocumentRevision.find({ documentId: record._id }).select('-fileDataBase64').sort({ archivedAt: -1 });
  res.json({ current: { recordNo: record.recordNo, revision: record.revision, status: record.status, approvalHistory: record.approvalHistory }, revisions });
});
router.get('/documents/:id/revisions/:revision/file', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid document ID.' });
  const revision = await QualityDocumentRevision.findOne({ documentId: req.params.id, revision: req.params.revision }).select('+fileDataBase64');
  if (!revision?.fileDataBase64) return res.status(404).json({ message: 'Archived file not found.' });
  res.setHeader('Content-Type', revision.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${revision.fileName.replace(/["\\\\]/g, '')}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(Buffer.from(revision.fileDataBase64, 'base64'));
});
router.post('/documents/:id/submit', authorize('manager','deputy_manager','shift_engineer'), async (req: any, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid document ID.' });
  const who = await actor(req);
  const doc = await QualityRecord.findOne({ _id: req.params.id, recordType: 'document' });
  if (!doc) return res.status(404).json({ message: 'Document not found.' });
  if (!['Draft','Rejected'].includes(doc.status)) return res.status(409).json({ message: 'Only Draft or Rejected documents can be submitted.' });
  if (!doc.fileName) return res.status(400).json({ message: 'Attach the controlled document before submitting it for review.' });
  doc.status = 'Under Review';
  doc.approvalHistory.push({ action: 'Submitted', actorId: who.id, actorName: who.name, actorRole: who.role, comments: String(req.body?.comments || ''), revision: doc.revision });
  await doc.save();
  res.json({ record: doc });
});
router.post('/documents/:id/review', authorize('manager','deputy_manager'), async (req: any, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid document ID.' });
  const who = await actor(req);
  const doc = await QualityRecord.findOne({ _id: req.params.id, recordType: 'document' });
  if (!doc) return res.status(404).json({ message: 'Document not found.' });
  if (doc.status !== 'Under Review') return res.status(409).json({ message: 'Document must be Under Review before review can be recorded.' });
  doc.reviewedBy = who.name;
  doc.status = 'Reviewed';
  doc.approvalHistory.push({ action: 'Reviewed', actorId: who.id, actorName: who.name, actorRole: who.role, comments: String(req.body?.comments || ''), revision: doc.revision });
  await doc.save();
  res.json({ record: doc });
});
router.post('/documents/:id/approve', authorize('manager'), async (req: any, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid document ID.' });
  const who = await actor(req);
  const doc = await QualityRecord.findOne({ _id: req.params.id, recordType: 'document' });
  if (!doc) return res.status(404).json({ message: 'Document not found.' });
  if (doc.status !== 'Reviewed') return res.status(409).json({ message: 'Only a reviewed document can be approved.' });
  if (String(doc.reviewedBy) === who.name) return res.status(403).json({ message: 'The reviewer cannot approve the same document revision.' });
  doc.approvedBy = who.name;
  doc.status = 'Approved';
  doc.approvalHistory.push({ action: 'Approved', actorId: who.id, actorName: who.name, actorRole: who.role, comments: String(req.body?.comments || ''), revision: doc.revision });
  await doc.save();
  res.json({ record: doc });
});
router.post('/documents/:id/reject', authorize('manager','deputy_manager'), async (req: any, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid document ID.' });
  const who = await actor(req);
  const doc = await QualityRecord.findOne({ _id: req.params.id, recordType: 'document' });
  if (!doc) return res.status(404).json({ message: 'Document not found.' });
  if (!['Under Review','Reviewed'].includes(doc.status)) return res.status(409).json({ message: 'Only documents under review can be rejected.' });
  if (!String(req.body?.comments || '').trim()) return res.status(400).json({ message: 'Rejection comments are mandatory.' });
  doc.status = 'Rejected';
  doc.approvalHistory.push({ action: 'Rejected', actorId: who.id, actorName: who.name, actorRole: who.role, comments: String(req.body.comments), revision: doc.revision });
  await doc.save();
  res.json({ record: doc });
});
router.post('/documents/:id/revisions', authorize('manager','deputy_manager','shift_engineer'), upload.single('file'), async (req: any, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid document ID.' });
  if (!String(req.body?.revision || '').trim() || !String(req.body?.changeSummary || '').trim()) return res.status(400).json({ message: 'New revision number and change summary are mandatory.' });
  if (!req.file) return res.status(400).json({ message: 'Attach the updated controlled file for every new revision.' });
  const who = await actor(req);
  const doc = await QualityRecord.findOne({ _id: req.params.id, recordType: 'document' }).select('+fileDataBase64');
  if (!doc) return res.status(404).json({ message: 'Document not found.' });
  if (!['Approved','Obsolete'].includes(doc.status)) return res.status(409).json({ message: 'Only an approved or obsolete revision can be superseded.' });
  if (doc.revision === req.body.revision) return res.status(409).json({ message: 'New revision must differ from current revision.' });
  await QualityDocumentRevision.create({
    documentId: doc._id, recordNo: doc.recordNo, revision: doc.revision, title: doc.title,
    department: doc.department, standard: doc.standard, clauses: doc.clauses, documentType: doc.documentType,
    equipment: doc.equipment, issueDate: doc.issueDate, reviewDate: doc.reviewDate, owner: doc.owner,
    fileName: doc.fileName, mimeType: doc.mimeType, fileDataBase64: doc.fileDataBase64,
    archivedBy: who.name, changeSummary: String(req.body.changeSummary),
  });
  doc.revision = String(req.body.revision).trim();
  doc.issueDate = req.body.issueDate || new Date();
  doc.reviewDate = req.body.reviewDate || null;
  doc.status = 'Draft'; doc.preparedBy = who.name; doc.reviewedBy = ''; doc.approvedBy = '';
  doc.changeSummary = String(req.body.changeSummary);
  if (req.file) { doc.fileName = req.file.originalname; doc.mimeType = req.file.mimetype; doc.fileDataBase64 = req.file.buffer.toString('base64'); }
  doc.approvalHistory.push({ action: 'Revision Created', actorId: who.id, actorName: who.name, actorRole: who.role, comments: doc.changeSummary, revision: doc.revision });
  await doc.save();
  res.json({ record: doc.toObject() });
});
router.patch('/documents/:id', authorize('manager','deputy_manager','shift_engineer'), async (req: any, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid document ID.' });
  const doc = await QualityRecord.findOne({ _id: req.params.id, recordType: 'document' });
  if (!doc) return res.status(404).json({ message: 'Document not found.' });
  if (!['Draft','Rejected'].includes(doc.status)) return res.status(409).json({ message: 'Only Draft or Rejected documents may be edited. Create a new revision for approved documents.' });
  for (const key of docFields) if (req.body?.[key] !== undefined) (doc as any)[key] = key === 'clauses' && typeof req.body[key] === 'string' ? req.body[key].split(',').map((x: string) => x.trim()) : req.body[key];
  await doc.save();
  res.json({ record: doc });
});
router.get('/documents/:id/file', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid document ID.' });
  const record = await QualityRecord.findOne({ _id: req.params.id, recordType: 'document' }).select('+fileDataBase64');
  if (!record?.fileDataBase64) return res.status(404).json({ message: 'No file is attached to this document.' });
  res.setHeader('Content-Type', record.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${record.fileName.replace(/["\\\\]/g, '')}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(Buffer.from(record.fileDataBase64, 'base64'));
});

router.get('/audits', async (_req, res) => {
  const records = await safeQuery(QualityRecord.find({ recordType: 'audit' }).sort({ auditDate: -1, updatedAt: -1 }));
  res.json({ records });
});
router.post('/audits', authorize('manager','deputy_manager','shift_engineer'), async (req: any, res) => {
  try {
    const { recordNo, title, department, standard, auditType, auditDate, auditor, findingType, finding, responsible, targetDate } = req.body;
    if (!recordNo?.trim() || !title?.trim()) return res.status(400).json({ message: 'Audit number and title are required.' });
    const record = await QualityRecord.create({ recordType: 'audit', recordNo: recordNo.trim(), title: title.trim(), department: department || 'E&I', standard: standard || '', auditType: auditType || 'Internal', auditDate: auditDate || null, auditor: auditor || (await actor(req)).name, findingType: findingType || 'Observation', finding: finding || '', responsible: responsible || '', targetDate: targetDate || null, status: 'Open' });
    res.status(201).json({ record });
  } catch (err: any) {
    if (err?.code === 11000) return res.status(409).json({ message: 'This audit number already exists.' });
    res.status(400).json({ message: err.message || 'Could not save audit.' });
  }
});
router.get('/capas', async (_req, res) => {
  const records = await safeQuery(QualityRecord.find({ recordType: 'capa' }).sort({ targetDate: 1, updatedAt: -1 }));
  res.json({ records });
});
router.post('/capas', authorize('manager','deputy_manager','shift_engineer'), async (req: any, res) => {
  try {
    const { recordNo, title, department, standard, findingType, finding, rootCause, correction, correctiveAction, responsible, targetDate, evidence, verifiedBy, effectivenessResult } = req.body;
    if (!recordNo?.trim() || !title?.trim()) return res.status(400).json({ message: 'NCR/CAPA number and title are required.' });
    const record = await QualityRecord.create({ recordType: 'capa', recordNo: recordNo.trim(), title: title.trim(), department: department || 'E&I', standard: standard || '', findingType: findingType || 'Minor NC', finding: finding || '', rootCause: rootCause || '', correction: correction || '', correctiveAction: correctiveAction || '', responsible: responsible || '', targetDate: targetDate || null, evidence: evidence || '', verifiedBy: verifiedBy || '', effectivenessResult: effectivenessResult || '', status: 'Open' });
    res.status(201).json({ record });
  } catch (err: any) {
    if (err?.code === 11000) return res.status(409).json({ message: 'This NCR/CAPA number already exists.' });
    res.status(400).json({ message: err.message || 'Could not save NCR/CAPA.' });
  }
});
router.patch('/records/:id', authorize('manager','deputy_manager','shift_engineer'), async (req: any, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid record ID.' });
  const record = await QualityRecord.findOne({ _id: req.params.id, recordType: { $in: ['audit','capa'] } });
  if (!record) return res.status(404).json({ message: 'Audit/CAPA record not found.' });
  const allowed = ['rootCause','correction','correctiveAction','responsible','targetDate','evidence','verifiedBy','verifiedDate','effectivenessResult','finding','findingType','auditor','auditDate'];
  for (const key of allowed) if (req.body?.[key] !== undefined) (record as any)[key] = req.body[key];
  if (req.body?.status === 'Closed') {
    if (record.recordType === 'capa') {
      if (!record.rootCause?.trim() || !record.correctiveAction?.trim() || !record.evidence?.trim() || !record.effectivenessResult?.trim() || !String(req.body.verifiedBy || record.verifiedBy || '').trim()) {
        return res.status(400).json({ message: 'CAPA closure requires root cause, corrective action, objective evidence, effectiveness result and verifier.' });
      }
      record.verifiedBy = req.body.verifiedBy || record.verifiedBy;
      record.verifiedDate = req.body.verifiedDate || new Date();
    }
    record.status = 'Closed'; record.closureDate = new Date();
  } else if (req.body?.status !== undefined) {
    if (!['Open','In Progress','Pending Verification'].includes(req.body.status)) return res.status(400).json({ message: 'Invalid status transition.' });
    record.status = req.body.status;
  }
  await record.save();
  res.json({ record });
});
export default router;
