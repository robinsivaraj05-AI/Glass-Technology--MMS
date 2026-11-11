import { Router } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import QualityRecord from '../models/QualityRecord';

const router = Router();
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv', 'image/jpeg', 'image/png', 'image/webp',
    ];
    if (!allowed.includes(file.mimetype)) return cb(new Error('File type not allowed. Upload PDF, Word, Excel, CSV or image files.'));
    cb(null, true);
  },
});

const withoutFile = (query: any) => query.select('-fileDataBase64');

router.get('/summary', async (_req, res) => {
  const [documents, audits, capas, dueDocuments, overdueCapas] = await Promise.all([
    QualityRecord.countDocuments({ recordType: 'document' }),
    QualityRecord.countDocuments({ recordType: 'audit' }),
    QualityRecord.countDocuments({ recordType: 'capa', status: { $ne: 'Closed' } }),
    QualityRecord.countDocuments({ recordType: 'document', reviewDate: { $lte: new Date() }, status: { $ne: 'Obsolete' } }),
    QualityRecord.countDocuments({ recordType: 'capa', targetDate: { $lt: new Date() }, status: { $ne: 'Closed' } }),
  ]);
  res.json({ documents, audits, openCapas: capas, dueDocuments, overdueCapas });
});

router.get('/documents', async (_req, res) => {
  const records = await withoutFile(QualityRecord.find({ recordType: 'document' }).sort({ updatedAt: -1 }));
  res.json({ records });
});

router.post('/documents', upload.single('file'), async (req, res) => {
  try {
    const { recordNo, title, department, standard, clauses, documentType, equipment, revision, issueDate, reviewDate, owner, preparedBy, reviewedBy, approvedBy, status } = req.body;
    if (!recordNo?.trim() || !title?.trim()) return res.status(400).json({ message: 'Document number and title are required.' });
    const payload: any = {
      recordType: 'document', recordNo: recordNo.trim(), title: title.trim(), department: department || 'E&I',
      standard: standard || '', clauses: clauses ? String(clauses).split(',').map((x: string) => x.trim()).filter(Boolean) : [],
      documentType: documentType || 'Record', equipment: equipment || '', revision: revision || '00',
      issueDate: issueDate || null, reviewDate: reviewDate || null, owner: owner || '',
      preparedBy: preparedBy || '', reviewedBy: reviewedBy || '', approvedBy: approvedBy || '',
      status: status || 'Draft',
    };
    if (req.file) {
      payload.fileName = req.file.originalname;
      payload.mimeType = req.file.mimetype;
      payload.fileDataBase64 = req.file.buffer.toString('base64');
    }
    const record = await QualityRecord.create(payload);
    const safe = record.toObject(); delete safe.fileDataBase64;
    res.status(201).json({ record: safe });
  } catch (err: any) {
    if (err?.code === 11000) return res.status(409).json({ message: 'This document number already exists.' });
    res.status(400).json({ message: err.message || 'Could not save document.' });
  }
});

router.patch('/documents/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid document ID.' });
  const allowed = ['title','department','standard','clauses','documentType','equipment','revision','issueDate','reviewDate','owner','preparedBy','reviewedBy','approvedBy','status'];
  const patch: any = {};
  for (const key of allowed) if (req.body?.[key] !== undefined) patch[key] = key === 'clauses' && typeof req.body[key] === 'string' ? req.body[key].split(',').map((x: string) => x.trim()) : req.body[key];
  const record = await QualityRecord.findOneAndUpdate({ _id: req.params.id, recordType: 'document' }, { $set: patch }, { new: true, runValidators: true }).select('-fileDataBase64');
  if (!record) return res.status(404).json({ message: 'Document not found.' });
  res.json({ record });
});

router.get('/documents/:id/file', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid document ID.' });
  const record = await QualityRecord.findOne({ _id: req.params.id, recordType: 'document' }).select('+fileDataBase64');
  if (!record || !record.fileDataBase64) return res.status(404).json({ message: 'No file is attached to this document.' });
  const safeName = record.fileName.replace(/["\\\\]/g, '');
  res.setHeader('Content-Type', record.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(Buffer.from(record.fileDataBase64, 'base64'));
});

router.get('/audits', async (_req, res) => {
  const records = await withoutFile(QualityRecord.find({ recordType: 'audit' }).sort({ auditDate: -1, updatedAt: -1 }));
  res.json({ records });
});
router.post('/audits', async (req, res) => {
  try {
    const { recordNo, title, department, standard, auditType, auditDate, auditor, findingType, finding, responsible, targetDate, status } = req.body;
    if (!recordNo?.trim() || !title?.trim()) return res.status(400).json({ message: 'Audit number and title are required.' });
    const record = await QualityRecord.create({ recordType: 'audit', recordNo: recordNo.trim(), title: title.trim(), department: department || 'E&I', standard: standard || '', auditType: auditType || 'Internal', auditDate: auditDate || null, auditor: auditor || '', findingType: findingType || 'Observation', finding: finding || '', responsible: responsible || '', targetDate: targetDate || null, status: status || 'Open' });
    res.status(201).json({ record });
  } catch (err: any) {
    if (err?.code === 11000) return res.status(409).json({ message: 'This audit number already exists.' });
    res.status(400).json({ message: err.message || 'Could not save audit.' });
  }
});

router.get('/capas', async (_req, res) => {
  const records = await withoutFile(QualityRecord.find({ recordType: 'capa' }).sort({ targetDate: 1, updatedAt: -1 }));
  res.json({ records });
});
router.post('/capas', async (req, res) => {
  try {
    const { recordNo, title, department, standard, findingType, finding, rootCause, correction, correctiveAction, responsible, targetDate, status } = req.body;
    if (!recordNo?.trim() || !title?.trim()) return res.status(400).json({ message: 'NCR/CAPA number and title are required.' });
    const record = await QualityRecord.create({ recordType: 'capa', recordNo: recordNo.trim(), title: title.trim(), department: department || 'E&I', standard: standard || '', findingType: findingType || 'Minor NC', finding: finding || '', rootCause: rootCause || '', correction: correction || '', correctiveAction: correctiveAction || '', responsible: responsible || '', targetDate: targetDate || null, status: status || 'Open' });
    res.status(201).json({ record });
  } catch (err: any) {
    if (err?.code === 11000) return res.status(409).json({ message: 'This NCR/CAPA number already exists.' });
    res.status(400).json({ message: err.message || 'Could not save NCR/CAPA.' });
  }
});
router.patch('/records/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid record ID.' });
  const allowed = ['status','rootCause','correction','correctiveAction','responsible','targetDate','evidence','verifiedBy','verifiedDate','closureDate','finding','findingType','auditor','auditDate'];
  const patch: any = {};
  for (const key of allowed) if (req.body?.[key] !== undefined) patch[key] = req.body[key];
  const record = await QualityRecord.findOneAndUpdate({ _id: req.params.id, recordType: { $in: ['audit','capa'] } }, { $set: patch }, { new: true, runValidators: true }).select('-fileDataBase64');
  if (!record) return res.status(404).json({ message: 'Audit/CAPA record not found.' });
  res.json({ record });
});
export default router;
