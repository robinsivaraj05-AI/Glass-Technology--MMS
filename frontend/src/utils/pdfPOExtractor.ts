// PDF Purchase Order extractor — uses pdfjs-dist to read text, then regex + positional parsing.

export interface ExtractedPO {
  poNo?: string;
  poDate?: string;
  rfqRef?: string;
  vendor?: string;
  vendorContact?: string;
  requestedBy?: string;
  approvedBy?: string;
  estimatedDelivery?: string;
  currency?: string;
  totalValue?: number;
  paymentTerms?: string;
  deliveryAddress?: string;
  items?: ExtractedItem[];
  fieldsFound: string[];
  confidence: number;
}

export interface ExtractedItem {
  description: string;
  specification: string;
  make: string;
  qty: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

interface Positioned { str: string; x: number; y: number }

// ── Init PDF.js worker (lazy, once) ──────────────────────────────────────────
let _ready = false;
async function getPdfJs() {
  const pdfjs = await import('pdfjs-dist');
  if (!_ready) {
    try {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).href;
    } catch {
      pdfjs.GlobalWorkerOptions.workerSrc =
        `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    }
    _ready = true;
  }
  return pdfjs;
}

// ── Entry point ───────────────────────────────────────────────────────────────
export async function extractPOFromPDF(file: File): Promise<ExtractedPO> {
  const pdfjs = await getPdfJs();

  const buffer   = await file.arrayBuffer();
  const pdf      = await pdfjs.getDocument({ data: buffer }).promise;

  const positioned: Positioned[] = [];
  let rawText = '';

  for (let p = 1; p <= pdf.numPages; p++) {
    const page     = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content  = await page.getTextContent();

    for (const raw of content.items as any[]) {
      if (!raw.str?.trim()) continue;
      positioned.push({
        str: raw.str,
        x:   raw.transform[4],
        y:   viewport.height - raw.transform[5],
      });
      rawText += raw.str + ' ';
    }
    rawText += '\n';
  }

  if (rawText.trim().length < 30) {
    throw new Error(
      'This PDF appears to be image-based (scanned). Only text-based PDFs can be parsed automatically.'
    );
  }

  const rows = groupRows(positioned);
  console.log('[PDF] rawText (first 1200):', rawText.slice(0, 1200));
  console.log('[PDF] rows (first 30):', JSON.stringify(rows.slice(0, 30)));
  return parse(rawText, rows);
}

// ── Group positioned items into visual rows ───────────────────────────────────
function groupRows(items: Positioned[], tol = 4): string[][] {
  const map = new Map<number, { str: string; x: number }[]>();
  for (const it of items) {
    const k = Math.round(it.y / tol);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push({ str: it.str, x: it.x });
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, cells]) =>
      cells.sort((a, b) => a.x - b.x).map(c => c.str.trim()).filter(Boolean)
    )
    .filter(r => r.length > 0);
}

// ── Date helpers ──────────────────────────────────────────────────────────────
const MONTH_MAP: Record<string, string> = {
  jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
  jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12',
};

function toISO(raw: string): string | undefined {
  const s = raw.trim();
  let m: RegExpMatchArray | null;

  m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;

  m = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;

  m = s.match(/^(\d{1,2})[\s\-]+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,\-]+(\d{4})$/i);
  if (m) return `${m[3]}-${MONTH_MAP[m[2].toLowerCase().slice(0,3)]}-${m[1].padStart(2,'0')}`;

  return undefined;
}

function findDate(text: string, ...prefixes: string[]): string | undefined {
  const DATE_PAT =
    '(\\d{1,2}[/\\-.]\\d{1,2}[/\\-.]\\d{4}' +
    '|\\d{4}[/\\-.]\\d{1,2}[/\\-.]\\d{1,2}' +
    '|\\d{1,2}[\\s\\-]+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\\s,]+\\d{4})';

  for (const prefix of prefixes) {
    const re = new RegExp(`${prefix}[\\s:./\\-]*${DATE_PAT}`, 'im');
    const m  = text.match(re);
    if (m) {
      const d = toISO(m[1]);
      if (d && !isNaN(new Date(d).getTime())) return d;
    }
  }
  return undefined;
}

// ── Row-based field finder ────────────────────────────────────────────────────
// Find value in same row after a label cell, or in next row
function findRowValue(rows: string[][], labelRe: RegExp): string | undefined {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const txt = row.join(' ');
    if (!labelRe.test(txt)) continue;

    // Check if value is a later cell in the same row
    const labelCellIdx = row.findIndex(c => labelRe.test(c));
    if (labelCellIdx >= 0 && labelCellIdx + 1 < row.length) {
      const candidate = row.slice(labelCellIdx + 1).join(' ').replace(/^[\s:./\-]+/, '').trim();
      if (candidate.length > 0) return candidate;
    }

    // Check if the label cell itself has the value (e.g. "DOCUMENT NO : 7600000201")
    if (labelCellIdx >= 0) {
      const cellTxt = row[labelCellIdx];
      const m = cellTxt.replace(labelRe, '').replace(/^[\s:./\-]+/, '').trim();
      if (m.length > 0) return m;
    }

    // Check next row
    if (i + 1 < rows.length && rows[i + 1].length > 0) {
      return rows[i + 1][0].trim();
    }
  }
  return undefined;
}

// ── Main parser ───────────────────────────────────────────────────────────────
function parse(text: string, rows: string[][]): ExtractedPO {
  const found: string[] = [];
  const result: ExtractedPO = { fieldsFound: found, confidence: 0 };

  // PO Number — try row-based first, then regex
  const docNoVal = findRowValue(rows, /DOCUMENT\s*NO/i);
  if (docNoVal && /\d/.test(docNoVal)) {
    // Extract just the number part (e.g. ": 7600000201" → "7600000201")
    const clean = docNoVal.replace(/^[\s:./\-]+/, '').split(/\s+/)[0];
    if (clean && /\d/.test(clean) && !toISO(clean)) {
      result.poNo = clean;
      found.push('poNo');
    }
  }
  if (!result.poNo) {
    const poPatterns = [
      /DOCUMENT\s+NO[\s:./\-]*([A-Z0-9][A-Z0-9\-\/_.]{1,20})/i,
      /P\.?O\.?\s*(?:No|Number|#|Ref)?[\s:./\-]*([A-Z0-9][A-Z0-9\-\/_.]{2,20})/i,
      /Purchase\s+Order\s*(?:No|Number|#)?[\s:./\-]+([A-Z0-9][A-Z0-9\-\/_.]{2,20})/i,
      /Order\s+No[\s:./\-]+([A-Z0-9][A-Z0-9\-\/_.]{2,20})/i,
    ];
    for (const re of poPatterns) {
      const m = text.match(re);
      // must contain a digit (prevents capturing labels like "VENDOR")
      if (m && /\d/.test(m[1]) && !toISO(m[1])) {
        result.poNo = m[1].trim();
        found.push('poNo');
        break;
      }
    }
  }

  // PO Date
  const poDate = findDate(text, 'DOCUMENT\\s*DATE', 'PO\\s*Date', 'Date', 'Dated', 'Issue\\s+Date');
  if (poDate) { result.poDate = poDate; found.push('poDate'); }

  // RFQ Reference
  const rfqM = text.match(/(?:RFQ|Quotation|Quote)\s*(?:No|Number|Ref)?[\s:./\-]*([A-Z0-9][A-Z0-9\-\/_.]{2,20})/i);
  if (rfqM && rfqM[1] && /\d/.test(rfqM[1])) { result.rfqRef = rfqM[1].trim(); found.push('rfqRef'); }

  // Vendor name — check same row after "VENDOR NAME" label, then next row first cell
  const vendorRowIdx = rows.findIndex(r => /VENDOR\s*NAME/i.test(r.join(' ')));
  if (vendorRowIdx >= 0) {
    const vRow = rows[vendorRowIdx];
    const labelIdx = vRow.findIndex(c => /VENDOR\s*NAME/i.test(c));

    // Case 1: value is in the same row after the label cell
    if (labelIdx >= 0 && labelIdx + 1 < vRow.length) {
      const candidate = vRow[labelIdx + 1].trim();
      // Reject if it looks like another label
      if (candidate.length > 3 && !/^(DELIVERY|SHIP|ADDRESS|TO|BILL)\b/i.test(candidate)) {
        result.vendor = candidate;
        found.push('vendor');
      }
    }
    // Case 2: value is in the next row's first cell
    if (!result.vendor && vendorRowIdx + 1 < rows.length) {
      const nextRow = rows[vendorRowIdx + 1];
      if (nextRow && nextRow[0] && nextRow[0].length > 3 && !/^(DELIVERY|SHIP|ADDRESS|TO)\b/i.test(nextRow[0])) {
        result.vendor = nextRow[0].trim();
        found.push('vendor');
      }
    }
  }
  // Fallback: regex on raw text
  if (!result.vendor) {
    const vm = text.match(/(?:Vendor|Supplier|M\/s\.?)[\s:]+([A-Z][^\n]{5,80})/im);
    if (vm) { result.vendor = vm[1].trim(); found.push('vendor'); }
  }

  // Vendor contact — prefer SUPPLIER CONTACT (phone), then email
  const scM = text.match(/SUPPLIER\s+CONTACT[\s:]*(\+?[\d\s\-]{7,25})/i);
  if (scM) {
    result.vendorContact = scM[1].trim();
    found.push('vendorContact');
  } else {
    const emailM = text.match(/[\w.+\-]+@[\w.\-]+\.[a-z]{2,}/i);
    if (emailM) { result.vendorContact = emailM[0]; found.push('vendorContact'); }
  }

  // Currency
  const currM = text.match(/\b(AED|USD|EUR|INR|GBP|SAR|QAR|OMR|KWD)\b/);
  if (currM) { result.currency = currM[1]; found.push('currency'); }

  // Grand Total — try regex first, then row-based
  const totalPatterns = [
    /Grand\s+Total[\s:]*(?:[A-Z]{3})?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /Total\s+Amount[\s:]*(?:[A-Z]{3})?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /Net\s+(?:Amount|Total)[\s:]*(?:[A-Z]{3})?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /Total[\s:]+(?:AED|USD|EUR|INR)\s*([\d,]+(?:\.\d{1,2})?)/i,
  ];
  for (const re of totalPatterns) {
    const m = text.match(re);
    if (m) { result.totalValue = parseFloat(m[1].replace(/,/g,'')); found.push('totalValue'); break; }
  }
  // Row-based fallback for grand total
  if (!result.totalValue) {
    const gtRowIdx = rows.findIndex(r => /Grand\s+Total/i.test(r.join(' ')));
    if (gtRowIdx >= 0) {
      const gtRow = rows[gtRowIdx];
      for (let j = gtRow.length - 1; j >= 0; j--) {
        const n = parseFloat(gtRow[j].replace(/,/g,''));
        if (!isNaN(n) && n > 0) { result.totalValue = n; found.push('totalValue'); break; }
      }
    }
  }

  // Payment Terms
  const payM = text.match(/Payment\s+Terms?[\s:]+([^\n\r]{5,80})/i);
  if (payM) {
    let pt = payM[1].trim();
    pt = pt.replace(/\s*(CURRENCY|INCOTERMS|VAT|TOTAL|REMARKS).*/i, '').trim();
    if (pt.length >= 5) { result.paymentTerms = pt.slice(0, 60); found.push('paymentTerms'); }
  }

  // Estimated Delivery
  const delDate = findDate(text,
    'Required\\s+[Bb]y', 'Delivery\\s+Date', 'Expected\\s+[Dd]elivery',
    'Desired\\s+[Dd]elivery', 'Delivery\\s+[Bb]y', 'Need\\s+[Bb]y', 'Completion\\s+Date',
  );
  if (delDate) { result.estimatedDelivery = delDate; found.push('estimatedDelivery'); }

  // Delivery Address
  const addrM = text.match(/(?:Deliver(?:y)?\s+(?:To|At|Address)|Ship\s+To|Consignee)[\s:]+([^\n]{10,100})/i);
  if (addrM) { result.deliveryAddress = addrM[1].trim(); found.push('deliveryAddress'); }

  // Requested / Prepared By
  const reqM = text.match(/(?:Requested|Prepared|Raised|Created)\s+[Bb]y[\s:]+([A-Za-z][A-Za-z\s.]{4,40})/i);
  if (reqM) { result.requestedBy = reqM[1].trim().replace(/\s+/g,' ').slice(0,40); found.push('requestedBy'); }

  // Approved By
  const appM = text.match(/(?:Approved|Authorized|Verified)\s+[Bb]y[\s:]+([A-Za-z][A-Za-z\s.]{4,40})/i);
  if (appM) { result.approvedBy = appM[1].trim().replace(/\s+/g,' ').slice(0,40); found.push('approvedBy'); }

  // Line items
  result.items = parseItems(rows, text);
  if (result.items.length > 0) found.push('items');

  result.confidence = Math.round((found.length / 13) * 100);
  return result;
}

// ── Line items parser ─────────────────────────────────────────────────────────
const UNIT_RE = /^(Nos?|NOS|Pcs?|PCS|Sets?|SETS|Meter|Mtr?|MTR|Roll|Rl|Kgs?|KG|Ltrs?|LTR|Boxes?|BOX|Pairs?|Lots?|Units?|UNIT|EA|Each|M|mm|CM|Pc|Qty|UOM|SQM|SQF|CTN|Bag|Can|Tin|Reel|Drum)$/i;
const DATE_CELL_RE = /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/;

function parseItems(rows: string[][], fallback: string): ExtractedItem[] {
  // Find table header row (has ≥2 of: description qty unit price amount)
  const HEADER_KW = ['description', 'qty', 'quantity', 'unit', 'price', 'amount', 'total'];
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const txt = rows[i].join(' ').toLowerCase();
    if (HEADER_KW.filter(k => txt.includes(k)).length >= 2) { headerIdx = i; break; }
  }

  // Find footer — MUST start AFTER the header (not at it, as header may contain "vat")
  const FOOTER_KW = ['sub total','subtotal','grand total','total amount'];
  let footerIdx = rows.length;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const txt = rows[i].join(' ').toLowerCase();
    if (FOOTER_KW.some(k => txt.includes(k))) { footerIdx = i; break; }
  }

  if (headerIdx < 0) return parseItemsRegex(fallback);

  const items: ExtractedItem[] = [];
  let cur: Partial<ExtractedItem> | null = null;

  for (let i = headerIdx + 1; i < footerIdx; i++) {
    const row = rows[i];
    if (!row.length) continue;

    // New item row: first cell is a small integer (1, 2, 3...)
    const slMatch = row[0].match(/^(\d{1,3})[.):]?$/);
    const isNew = slMatch !== null && parseInt(slMatch[1]) >= 1 && parseInt(slMatch[1]) <= 200;

    if (isNew) {
      if (cur?.description) items.push(finalizeItem(cur));
      cur = { description: '', specification: '', make: '', qty: 1, unit: 'Nos', unitPrice: 0, totalPrice: 0 };

      const cells = row.slice(1);                               // drop sl.no
      const filtered = cells.filter(c => !DATE_CELL_RE.test(c)); // remove date columns

      if (filtered.length === 0) continue;

      // Last cell = total amount
      const lastNum = parseFloat(filtered[filtered.length - 1]?.replace(/,/g,'') ?? '');
      if (!isNaN(lastNum) && lastNum > 0) cur.totalPrice = lastNum;

      // Find unit keyword (scan right-to-left, stop before last cell)
      let unitIdx = -1;
      for (let j = filtered.length - 2; j >= 0; j--) {
        if (UNIT_RE.test(filtered[j])) { unitIdx = j; break; }
      }

      if (unitIdx >= 0) {
        cur.unit = /^UOM$/i.test(filtered[unitIdx]) ? 'Nos' : filtered[unitIdx];

        // Numbers after unit (excluding last = total)
        const afterUnit = filtered.slice(unitIdx + 1, filtered.length - 1);
        const afterNums = afterUnit
          .map(c => parseFloat(c.replace(/,/g,'')))
          .filter(n => !isNaN(n) && n > 0);

        // Number immediately before unit
        const beforeUnitRaw = unitIdx > 0 ? filtered[unitIdx - 1] : '';
        const beforeUnit = parseFloat(beforeUnitRaw.replace(/,/g,''));
        const qtyIsBefore = !isNaN(beforeUnit) && beforeUnit > 0 && !/[a-z]/i.test(beforeUnitRaw);

        if (qtyIsBefore) {
          // Format: ... Description Qty UOM UnitPrice ... Total
          cur.qty = beforeUnit;
          if (afterNums.length > 0) cur.unitPrice = afterNums[0];
        } else if (afterNums.length >= 2) {
          // Format: ... Description UOM Qty UnitPrice ... Total  (Glass Technology)
          cur.qty = afterNums[0];
          cur.unitPrice = afterNums[1];
        } else if (afterNums.length === 1) {
          cur.unitPrice = afterNums[0];
        }

        // Description = all text cells before unit (or before qty if qty is before unit)
        const descEnd = qtyIsBefore ? unitIdx - 1 : unitIdx;
        const descCells = filtered.slice(0, descEnd)
          .filter(c => !/^\d+$/.test(c)); // remove purely numeric item codes
        cur.description = descCells.join(' ').trim()
          || filtered.slice(0, descEnd).join(' ').trim();
      } else {
        // No unit found — take all non-numeric text as description
        cur.description = filtered.slice(0, filtered.length - 1)
          .filter(c => !/^\d+$/.test(c)).join(' ').trim();
      }
    } else if (cur) {
      // Continuation row — part number / make / specification
      const txt = row.join(' ').trim();
      if (!txt) continue;
      if (/^[Mm]ake\s*:/i.test(txt)) {
        cur.make = txt.replace(/^[Mm]ake\s*:\s*/i, '').trim();
      } else if (/^(?:Part\s*(?:No|#)|Spec|P\/N|HSN)\s*:/i.test(txt)) {
        cur.specification = txt.replace(/^.*?:\s*/i, '').trim();
      } else if (!cur.specification && !/^\d+$/.test(txt)) {
        cur.specification = txt;
      }
    }
  }
  if (cur?.description) items.push(finalizeItem(cur));
  return items;
}

function parseItemsRegex(text: string): ExtractedItem[] {
  const re = /^\s*(\d{1,2})[.)]\s+(.{5,100?}?)\s{2,}(\d+(?:\.\d+)?)\s+(Nos?|Pcs?|Sets?|Units?|EA|Meter|Kg)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s*$/gim;
  const items: ExtractedItem[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null && items.length < 20) {
    items.push({
      description: m[2].trim(),
      specification: '',
      make: '',
      qty:        parseFloat(m[3]),
      unit:       m[4],
      unitPrice:  parseFloat(m[5].replace(/,/g,'')),
      totalPrice: parseFloat(m[6].replace(/,/g,'')),
    });
  }
  return items;
}

function finalizeItem(item: Partial<ExtractedItem>): ExtractedItem {
  const qty       = item.qty ?? 1;
  const unitPrice = item.unitPrice ?? 0;
  return {
    description:   item.description   ?? '',
    specification: item.specification ?? '',
    make:          item.make          ?? '',
    qty,
    unit:       item.unit       ?? 'Nos',
    unitPrice,
    totalPrice: item.totalPrice ?? qty * unitPrice,
  };
}
