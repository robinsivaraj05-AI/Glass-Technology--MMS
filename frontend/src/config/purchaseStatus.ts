// Purchase follow-up workflow, in order. "Rejected" sits outside the sequence.
export const STATUS_FLOW = [
  'RFQ created',
  'Quotation Received',
  'Technical Review Under Progress',
  'Technical Review Done',
  'PO done',
  'Partially Received',
  'Material Received',
] as const;
export const REJECTED = 'Rejected Material / PO';

// Old names (before the workflow was split) → new names
const LEGACY: Record<string, string> = {
  'Technical Review': 'Technical Review Under Progress',
  'Rejected': REJECTED,
};
export const normaliseStatus = (s: string): string => LEGACY[s] ?? s;
export const isRejected = (s: string): boolean => normaliseStatus(s) === REJECTED;

/** 1-based step number in the workflow, 0 for unknown / rejected */
export const stepOf = (s: string): number => (STATUS_FLOW as readonly string[]).indexOf(normaliseStatus(s)) + 1;
/** Dropdown label, e.g. "3. Technical Review Under Progress" */
export const statusLabel = (s: string): string => {
  if (!s) return '';
  const n = stepOf(s);
  return n ? `${n}. ${s}` : isRejected(s) ? `✕ ${s}` : s;
};

export const STATUS_WEB: Record<string, { bg: string; tc: string }> = {
  'RFQ created':                     { bg: 'rgba(59,130,246,0.85)',  tc: '#fff' },
  'Quotation Received':              { bg: 'rgba(139,92,246,0.85)',  tc: '#fff' },
  'Technical Review Under Progress': { bg: 'rgba(234,88,12,0.85)',   tc: '#fff' },
  'Technical Review Done':           { bg: 'rgba(13,148,136,0.88)',  tc: '#fff' },
  'PO done':                         { bg: 'rgba(180,130,0,0.90)',   tc: '#fff' },
  'Partially Received':              { bg: 'rgba(220,38,38,0.85)',   tc: '#fff' },
  'Material Received':               { bg: 'rgba(22,163,74,0.85)',   tc: '#fff' },
  [REJECTED]:                        { bg: 'rgba(71,85,105,0.85)',   tc: '#fff' },
};

export const STATUS_XLS: Record<string, string> = {
  'RFQ created':                     '#4472C4',
  'Quotation Received':              '#7030A0',
  'Technical Review Under Progress': '#FFA500',
  'Technical Review Done':           '#0D9488',
  'PO done':                         '#B8860B',
  'Partially Received':              '#FF0000',
  'Material Received':               '#00B050',
  [REJECTED]:                        '#808080',
};

export interface StatusChange { status: string; from: string; at: string; }
