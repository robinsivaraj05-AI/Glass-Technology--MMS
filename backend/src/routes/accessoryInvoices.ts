import { Router, Request, Response } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import InvoiceDraft from '../models/InvoiceDraft';
import AccessoryEntry from '../models/AccessoryEntry';

const router = Router();
const MAX_FILE_BYTES = 7 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) return cb(new Error('Only JPG, PNG, WEBP and PDF invoices are accepted.'));
    cb(null, true);
  },
});

const emptyInvoice = () => ({
  supplierName: '', invoiceNumber: '', invoiceDate: null, deliveryOrderNumber: '',
  poNumber: '', customerName: '', itemName: '', quantity: null, unit: '',
  unitRate: null, subtotal: null, vatPercent: 5, vatAmount: null,
  grandTotal: null, currency: 'AED', equipmentName: '', area: '', confidenceNotes: [],
});

function parseModelJson(text: string) {
  const cleaned = text.trim().replace(/^\x60\x60\x60(?:json)?/i, '').replace(/\x60\x60\x60$/i, '').trim();
  return JSON.parse(cleaned);
}

async function extractInvoice(file: Express.Multer.File) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured on the backend.');
  const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
  const content = file.mimetype === 'application/pdf'
    ? [{ type: 'input_file', filename: file.originalname, file_data: dataUrl }]
    : [{ type: 'input_image', image_url: dataUrl, detail: 'high' }];

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || 'gpt-4.1-mini',
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: `Read this supplier invoice for an industrial maintenance Accessories & Consumables register. Return ONLY valid JSON with these keys: supplierName, invoiceNumber, invoiceDate (YYYY-MM-DD or null), deliveryOrderNumber, poNumber, customerName, itemName, quantity (number or null), unit, unitRate (number or null), subtotal (number or null), vatPercent (number or null), vatAmount (number or null), grandTotal (number or null), currency, equipmentName, area, confidenceNotes (array of strings). Do not guess unreadable values: use empty string or null and explain uncertainty in confidenceNotes. Preserve the printed quantity unit exactly (for example G, Gallons, L, Liters). Use numeric values without currency symbols or commas. If equipmentName or area is not printed, leave blank. Distinguish invoice number from delivery order number. Confirm arithmetic but do not change printed figures.` },
          ...content
        ]
      }],
      text: { format: { type: 'json_object' } },
      max_output_tokens: 1200
    })
  });

  const body: any = await response.json();
  if (!response.ok) throw new Error(body?.error?.message || 'Invoice extraction failed.');
  const outputText = body.output?.flatMap((o: any) => o.content || []).find((c: any) => c.type === 'output_text')?.text;
  if (!outputText) throw new Error('AI did not return invoice data.');
  return { ...emptyInvoice(), ...parseModelJson(outputText) };
}

function validateExtracted(x: any) {
  const requiredNumeric = ['quantity', 'unitRate', 'subtotal', 'vatPercent', 'vatAmount', 'grandTotal'];
  for (const key of requiredNumeric) {
    if (x[key] !== null && x[key] !== undefined && (!Number.isFinite(Number(x[key])) || Number(x[key]) < 0)) {
      throw new Error(`Invalid numeric value for ${key}`);
    }
  }
  return x;
}

router.post('/extract', upload.single('invoice'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Select an invoice photograph or PDF.' });
    const extracted = validateExtracted(await extractInvoice(req.file));
    const draft = await InvoiceDraft.create({
      originalFilename: req.file.originalname,
      mimeType: req.file.mimetype,
      fileDataBase64: req.file.buffer.toString('base64'),
      extracted,
      status: 'pending',
      createdBy: (req as any).user?.id || '',
    });
    const safe = draft.toObject();
    delete safe.fileDataBase64;
    res.status(201).json({ draft: safe, message: 'Invoice extracted. Review the details before approval.' });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Could not process invoice.' });
  }
});

router.get('/drafts', async (_req, res) => {
  const drafts = await InvoiceDraft.find({ status: 'pending' }).sort({ createdAt: -1 }).select('-fileDataBase64');
  res.json({ drafts });
});

router.get('/drafts/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid draft ID.' });
  const draft = await InvoiceDraft.findOne({ _id: req.params.id, status: 'pending' }).select('-fileDataBase64');
  if (!draft) return res.status(404).json({ message: 'Pending invoice draft not found.' });
  res.json({ draft });
});

router.get('/drafts/:id/file', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid draft ID.' });
  const draft = await InvoiceDraft.findById(req.params.id).select('+fileDataBase64');
  if (!draft) return res.status(404).json({ message: 'Invoice draft not found.' });
  const buffer = Buffer.from(draft.fileDataBase64, 'base64');
  res.setHeader('Content-Type', draft.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${draft.originalFilename.replace(/["\\\\]/g, '')}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(buffer);
});

router.patch('/drafts/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid draft ID.' });
  const allowed = ['supplierName','invoiceNumber','invoiceDate','deliveryOrderNumber','poNumber','customerName','itemName','quantity','unit','unitRate','subtotal','vatPercent','vatAmount','grandTotal','currency','equipmentName','area','confidenceNotes'];
  const extracted: any = {};
  for (const key of allowed) if (req.body?.[key] !== undefined) extracted[key] = req.body[key];
  const draft = await InvoiceDraft.findOneAndUpdate(
    { _id: req.params.id, status: 'pending' },
    { $set: Object.fromEntries(Object.entries(extracted).map(([k,v]) => [`extracted.${k}`, v])) },
    { new: true, runValidators: true }
  ).select('-fileDataBase64');
  if (!draft) return res.status(404).json({ message: 'Pending invoice draft not found.' });
  res.json({ draft });
});

router.post('/drafts/:id/approve', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid draft ID.' });
  const session = await mongoose.startSession();
  try {
    let savedEntry: any = null;
    await session.withTransaction(async () => {
      const draft = await InvoiceDraft.findOne({ _id: req.params.id, status: 'pending' }).session(session);
      if (!draft) throw new Error('Pending invoice draft not found or already processed.');
      const x: any = draft.extracted;
      if (!x.itemName || x.quantity === null || x.unitRate === null || x.grandTotal === null) {
        throw new Error('Item, quantity, unit rate and grand total must be reviewed and completed before approval.');
      }
      if (x.subtotal !== null && x.vatAmount !== null && x.grandTotal !== null) {
        const calculated = Math.round((Number(x.subtotal) + Number(x.vatAmount)) * 100) / 100;
        if (Math.abs(calculated - Number(x.grandTotal)) > 0.02) throw new Error('Subtotal + VAT does not match the grand total. Correct the invoice details before approval.');
      }
      const invoiceNo = String(x.invoiceNumber || '').trim();
      const doNo = String(x.deliveryOrderNumber || '').trim();
      const duplicateOrExisting: any = await AccessoryEntry.findOne({
        $or: [
          ...(invoiceNo ? [{ invoiceNumber: invoiceNo }] : []),
          ...(doNo ? [{ deliveryOrderNumber: doNo }, { poNumber: new RegExp(doNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }] : [])
        ]
      }).session(session);

      const item = {
        itemName: x.itemName || 'Other',
        category: /diesel|petrol|fuel/i.test(x.itemName) ? 'Fuel' : 'Other',
        unit: x.unit || 'Pcs',
        quantity: Number(x.quantity),
        unitRate: Number(x.unitRate),
        totalCost: Math.round(Number(x.quantity) * Number(x.unitRate) * 100) / 100,
      };
      const payload: any = {
        entryDate: x.invoiceDate || new Date(),
        equipmentName: x.equipmentName || duplicateOrExisting?.equipmentName || '',
        poNumber: doNo ? `D.O. No: ${doNo}` : (x.poNumber || ''),
        department: 'E&I',
        area: x.area || duplicateOrExisting?.area || '',
        items: [item],
        subTotal: x.subtotal ?? item.totalCost,
        vatPercent: x.vatPercent ?? 0,
        vatAmount: x.vatAmount ?? 0,
        totalCost: Number(x.grandTotal),
        approvedBy: req.body?.approvedBy || '',
        remarks: [x.supplierName && `Supplier: ${x.supplierName}`, invoiceNo && `Invoice: ${invoiceNo}`, 'Source: Invoice Scan & Upload'].filter(Boolean).join(' | '),
        invoiceNumber: invoiceNo,
        deliveryOrderNumber: doNo,
        supplierName: x.supplierName || '',
        invoiceCurrency: x.currency || 'AED',
        invoiceDraftId: draft._id,
      };
      if (duplicateOrExisting) {
        savedEntry = await AccessoryEntry.findByIdAndUpdate(duplicateOrExisting._id, { $set: payload }, { new: true, runValidators: true, session });
      } else {
        [savedEntry] = await AccessoryEntry.create([payload], { session });
      }
      draft.status = 'approved';
      draft.reviewedBy = req.body?.approvedBy || (req as any).user?.id || '';
      draft.accessoryEntryId = savedEntry._id;
      await draft.save({ session });
    });
    res.json({ message: 'Invoice approved and Accessories entry saved.', entry: savedEntry });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Approval failed.' });
  } finally {
    await session.endSession();
  }
});

router.post('/drafts/:id/reject', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid draft ID.' });
  const draft = await InvoiceDraft.findOneAndUpdate(
    { _id: req.params.id, status: 'pending' },
    { $set: { status: 'rejected', rejectionReason: String(req.body?.reason || 'Rejected during review'), reviewedBy: (req as any).user?.id || '' } },
    { new: true }
  ).select('-fileDataBase64');
  if (!draft) return res.status(404).json({ message: 'Pending invoice draft not found.' });
  res.json({ draft, message: 'Invoice draft rejected.' });
});

export default router;
