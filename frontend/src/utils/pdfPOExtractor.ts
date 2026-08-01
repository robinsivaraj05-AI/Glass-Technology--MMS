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
  fieldsFound: string[];   // list of field keys successfully extracted
  confidence: number;      // 0–100
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
        y:   viewport.height - raw.transform[5],   // flip: y=0 at top
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
  return parse(rawText, rows);
}

// ── Group positioned items into visual rows ───────────────────────────────────
function groupRows(items: Positioned[], tol = 3): string[][] {
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

  // dd/mm/yyyy or dd-mm-yyyy or dd.mm.yyyy
  m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;

  // yyyy-mm-dd
  m = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;

  // dd-Mon-yyyy or dd Mon yyyy
  m = s.match(/^(\d{1,2})[\s\-]+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,\-]+(\d{4})$/i);
  if (m) return `${m[3]}-${MONTH_MAP[m[2].toLowerCase().slice(0,3)]}-${m[1].padStart(2,'0')}`;

  return undefined;
}

function findDate(text: string, ...prefixes: string[]): string | undefined {
  const DATE_PAT =
    '(\\d{1,2}[/\\-.]\\d{1,2}[/\\-.](\\d{4})' +
    '|\\d{4}[/\\-.] \\d{1,2}[/\\.\\-]\\d{1,2}' +
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

// ── Main parser ───────────────────────────────────────────────────────────────
function parse(text: string, rows: string[][]): ExtractedPO {
  const found: string[] = [];
  const result: ExtractedPO = { fieldsFound: found, confidence: 0 };

  // PO Number
  const poPatterns = [
    /DOCUMENT\s+NO[\s:./\-]*([A-Z0-9][A-Z0-9\-\/_.]{2,20})/i,
    /P\.?O\.?\s*(?:No|Number|#|Ref)?[\s:./\-]*([A-Z0-9][A-Z0-9\-\/_.]{2,20})/i,
    /Purchase\s+Order\s*(?:No|Number|#)?[\s:./\-]+([A-Z0-9][A-Z0-9\-\/_.]{2,20})/i,
    /Order\s+No[\s:./\-]+([A-Z0-9][A-Z0-9\-\/_.]{2,20})/i,
  ];
  for (const re of poPatterns) {
    const m = text.match(re);
    if (m && !/^\d{1,2}[\/\-\.]/.test(m[1])) { // not a date
      result.poNo = m[1].trim();
      found.push('poNo');
      break;
    }
  }

  // PO Date
  const poDate = findDate(text, 'DOCUMENT\\s+DATE', 'PO\\s+Date', 'Date', 'Dated', 'Issue\\s+Date');
  if (poDate) { result.poDate = poDate; found.push('poDate'); }

  // RFQ Reference
  const rfqM = text.match(/(?:RFQ|Quotation|Quote)\s*(?:No|Number|Ref)?[\s:./\-]*([A-Z0-9][A-Z0-9\-\/_.]{2,20})/i);
  if (rfqM && rfqM[1]) { result.rfqRef = rfqM[1].trim(); found.push('rfqRef'); }

  // Vendor name — look for "VENDOR NAME" section first, then "To:" row, then regex
  const vendorNameIdx = rows.findIndex(r => /VENDOR\s*NAME/i.test(r.join(' ')));
  if (vendorNameIdx >= 0 && vendorNameIdx + 1 < rows.length) {
    // Next non-empty row after VENDOR NAME header is the vendor
    const nextRow = rows[vendorNameIdx + 1];
    if (nextRow && nextRow.length > 0) {
      result.vendor = nextRow.join(' ').trim();
      found.push('vendor');
    }
  } else {
    const toRow = rows.find(r => /^(?:To|Vendor|Supplier|M\/s\.?)[\s:]?$/i.test(r[0]));
    if (toRow && toRow.length > 1) {
      result.vendor = toRow.slice(1).join(' ').trim();
      found.push('vendor');
    } else {
      const vm = text.match(/(?:^|\n)\s*(?:To|Vendor|Supplier|M\/s\.?)[\s:]+([A-Z][^\n]{5,80})/im);
      if (vm) { result.vendor = vm[1].trim(); found.push('vendor'); }
    }
  }

  // Vendor contact — prefer SUPPLIER CONTACT field, then email
  const supplierContactM = text.match(/SUPPLIER\s+CONTACT[\s:]+([^\n\r]{5,60})/i);
  if (supplierContactM) {
    result.vendorContact = supplierContactM[1].trim();
    found.push('vendorContact');
  } else {
    const emailM = text.match(/[\w.+\-]+@[\w.\-]+\.[a-z]{2,}/i);
    if (emailM) { result.vendorContact = emailM[0]; found.push('vendorContact'); }
  }

  // Currency
  const currM = text.match(/\b(AED|USD|EUR|INR|GBP|SAR|QAR|OMR|KWD)\b/);
  if (currM) { result.currency = currM[1]; found.push('currency'); }

  // Grand Total
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

  // Payment Terms
  const payM = text.match(/Payment\s+Terms?[\s:]+([^\n\r.]{5,80})/i);
  if (payM) { result.paymentTerms = payM[1].trim().slice(0,60); found.push('paymentTerms'); }

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
const UNIT_RE = /^(Nos?|Pcs?|Sets?|Meter|Roll|Kgs?|Ltrs?|Boxes?|Pairs?|Lots?|Units?|EA|Each|M|mm|Pc|Qty|UOM)$/i;
const DATE_CELL_RE = /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/;

function parseItems(rows: string[][], fallback: string): ExtractedItem[] {
  // Find table header row (has ≥2 of: description qty unit price amount)
  const HEADER_KW = ['description', 'qty', 'quantity', 'unit', 'price', 'amount', 'total'];
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const txt = rows[i].join(' ').toLowerCase();
    if (HEADER_KW.filter(k => txt.includes(k)).length >= 2) { headerIdx = i; break; }
  }

  // Find footer (sub total / grand total)
  const FOOTER_KW = ['sub total','subtotal','grand total','total amount','vat','discount','tax'];
  let footerIdx = rows.length;
  for (let i = Math.max(0, headerIdx); i < rows.length; i++) {
    const txt = rows[i].join(' ').toLowerCase();
    if (FOOTER_KW.some(k => txt.includes(k))) { footerIdx = i; break; }
  }

  if (headerIdx < 0) return parseItemsRegex(fallback); // no table found

  const items: ExtractedItem[] = [];
  let cur: Partial<ExtractedItem> | null = null;

  for (let i = headerIdx + 1; i < footerIdx; i++) {
    const row = rows[i];
    if (!row.length) continue;

    // New item row: first cell is a small integer
    const slMatch = row[0].match(/^(\d{1,3})[.):]?$/);
    const isNew = slMatch !== null && parseInt(slMatch[1]) >= 1;

    if (isNew) {
      if (cur?.description) items.push(finalizeItem(cur));
      cur = { description: '', specification: '', make: '', qty: 1, unit: 'Nos', unitPrice: 0, totalPrice: 0 };

      const cells = row.slice(1); // drop sl.no

      // Remove item code (first cell if it looks like a numeric code and no unit nearby)
      // Remove date cells (delivery date columns like 13-08-2026)
      const filtered = cells.filter(c => !DATE_CELL_RE.test(c));

      const lastNum = parseFloat(filtered[filtered.length - 1]?.replace(/,/g,'') ?? '');
      if (!isNaN(lastNum)) cur.totalPrice = lastNum;

      // Find unit keyword in filtered cells (scan right-to-left)
      let unitIdx = -1;
      for (let j = filtered.length - 1; j >= 0; j--) {
        if (UNIT_RE.test(filtered[j])) { unitIdx = j; break; }
      }

      if (unitIdx >= 0) {
        cur.unit = filtered[unitIdx] === 'UOM' ? 'Nos' : filtered[unitIdx];
        // qty is immediately before unit
        if (unitIdx > 0) {
          const q = parseFloat(filtered[unitIdx - 1].replace(/,/g,''));
          if (!isNaN(q)) cur.qty = q;
        }
        // unit price is immediately after unit (skip VAT% and VAT amount columns — pick smallest price)
        const afterUnit = filtered.slice(unitIdx + 1, filtered.length - 1)
          .map(c => parseFloat(c.replace(/,/g,'')))
          .filter(n => !isNaN(n) && n > 0);
        if (afterUnit.length > 0) cur.unitPrice = Math.min(...afterUnit);

        // description = everything before (qty - 1), skipping pure numeric item codes
        const descCells = filtered.slice(0, Math.max(0, unitIdx - 1))
          .filter(c => !/^\d+$/.test(c)); // remove pure numeric item codes
        cur.description = descCells.join(' ').trim() || filtered.slice(0, unitIdx).join(' ').trim();
      } else {
        cur.description = filtered.slice(0, filtered.length - 1)
          .filter(c => !/^\d+$/.test(c)).join(' ').trim();
      }
    } else if (cur) {
      // Continuation row — part number / make / specification
      const txt = row.join(' ').trim();
      if (!txt) continue;
      if (/^[Mm]ake\s*:/i.test(txt)) {
        cur.make = txt.replace(/^[Mm]ake\s*:\s*/i, '').trim();
      } else if (/^(?:Part\s*(?:No|#)|Spec|P\/N)\s*:/i.test(txt)) {
        cur.specification = txt.replace(/^.*?:\s*/i, '').trim();
      } else if (!cur.specification) {
        cur.specification = txt;
      }
    }
  }
  if (cur?.description) items.push(finalizeItem(cur));
  return items;
}

function parseItemsRegex(text: string): ExtractedItem[] {
  // Fallback regex for simple single-line item rows
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
