import { useMemo, useState, Fragment } from 'react';
import { ChevronDown, ChevronRight, History } from 'lucide-react';
import { STATUS_FLOW, REJECTED, STATUS_WEB, normaliseStatus, isRejected, stepOf, statusLabel, type StatusChange } from '../config/purchaseStatus';

// Purchase History: for every item, the date it reached each workflow stage,
// taken from the status change log the server writes on every status change.

interface Rec {
  id: string; itemDescription: string; prNumber: string; requestDate: string;
  currentStatus: string; statusHistory?: StatusChange[]; updatedAt?: string;
}

const DAY = 86400000;
const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
const fmtTime = (d: Date) => d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
// Whole calendar days between two dates (10 Oct → 19 Oct = 9), ignoring time of day
const dayNo = (d: Date) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
const days = (a: Date, b: Date) => Math.max(0, dayNo(b) - dayNo(a));
// "2026-10-10" is a calendar date — read it as local midnight, not UTC
const parseDay = (s: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s); };
const SHORT: Record<string, string> = {
  'RFQ created': 'RFQ Created', 'Quotation Received': 'Quotation Received',
  'Technical Review Under Progress': 'Tech. Review In Progress', 'Technical Review Done': 'Tech. Review Done',
  'PO done': 'PO Done', 'Partially Received': 'Partially Received', 'Material Received': 'Material Received',
};

function analyse(r: Rec) {
  const log = (r.statusHistory || [])
    .map(h => ({ status: normaliseStatus(h.status), from: normaliseStatus(h.from || ''), at: new Date(h.at) }))
    .filter(h => !isNaN(h.at.getTime()))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const reached = new Map<string, Date>();
  for (const h of log) if (!reached.has(h.status)) reached.set(h.status, h.at);
  const current = normaliseStatus(r.currentStatus || '');
  const curStep = stepOf(current);
  const rejectedAt = [...log].reverse().find(h => h.status === REJECTED)?.at;
  const lastChange = log.length ? log[log.length - 1].at : (r.updatedAt ? new Date(r.updatedAt) : null);
  // Request date and "RFQ created" are the same moment → one start date
  const start = r.requestDate ? parseDay(r.requestDate) : (reached.get('RFQ created') ?? log[0]?.at);
  const doneAt = reached.get('Material Received');
  const completed = current === 'Material Received' || current === REJECTED;
  const endAt = doneAt ?? rejectedAt;          // when it was completed / rejected (if logged)
  return { log, reached, current, curStep, rejectedAt, lastChange, start, doneAt, completed, endAt };
}

export default function PurchaseStatusHistory({ records }: { records: Rec[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [view, setView] = useState<'pending' | 'completed'>('pending');
  const all = useMemo(() => records.map(r => ({ r, a: analyse(r) })), [records]);
  const pendingRows   = useMemo(() => all.filter(x => !x.a.completed)
    .sort((x, y) => (x.a.start?.getTime() ?? Infinity) - (y.a.start?.getTime() ?? Infinity)), [all]);   // oldest request first
  const finishedAt = (a: ReturnType<typeof analyse>) => (a.endAt ?? a.lastChange)?.getTime() ?? 0;
  const completedRows = useMemo(() => all.filter(x => x.a.completed)
    .sort((x, y) => finishedAt(y.a) - finishedAt(x.a)), [all]);   // latest completed first
  const rows = view === 'pending' ? pendingRows : completedRows;

  const weekAgo = Date.now() - 7 * DAY;
  const changesThisWeek = rows.reduce((n, { a }) => n + a.log.filter(h => h.at.getTime() >= weekAgo).length, 0);
  const atStage = (st: string) => rows.filter(({ a }) => a.current === st).length;
  const summaryStages = view === 'pending' ? STATUS_FLOW.slice(0, -1) : ['Material Received', REJECTED];
  // "RFQ created" is shown in the first column together with the request date
  const STAGES = STATUS_FLOW.slice(1);
  const today = new Date();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Pending / Completed */}
      <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', padding: 4, borderRadius: 10, width: 'fit-content' }}>
        {([
          { key: 'pending',   label: 'Pending',   count: pendingRows.length,   color: '#f59e0b' },
          { key: 'completed', label: 'Completed', count: completedRows.length, color: '#16a34a' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => { setView(t.key); setOpen(null); }} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 700, background: view === t.key ? '#fff' : 'transparent', color: view === t.key ? t.color : '#64748b',
            boxShadow: view === t.key ? '0 1px 3px rgba(15,23,42,0.12)' : 'none',
          }}>
            {t.label}
            <span style={{ padding: '0 8px', borderRadius: 20, fontSize: 11, background: view === t.key ? `${t.color}22` : '#E2E8F0', color: view === t.key ? t.color : '#64748b' }}>{t.count}</span>
          </button>
        ))}
        <span style={{ alignSelf: 'center', fontSize: 11, color: '#94a3b8', padding: '0 8px' }}>
          {view === 'pending' ? 'Not yet received · oldest request first' : 'Material received or rejected · latest first'}
        </span>
      </div>

      {/* Where items are now */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <History size={16} color="#6366f1"/>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginRight: 4 }}>Items at each stage</span>
        {summaryStages.map(st => (
          <span key={st} title={st} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: STATUS_WEB[st]?.bg, color: '#fff' }}>
            {statusLabel(st).replace(/^(\d+)\. .*/, '$1')}{isRejected(st) ? '✕' : ''} {SHORT[st] || 'Rejected'} <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 10, padding: '0 6px' }}>{atStage(st)}</span>
          </span>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b' }}>{changesThisWeek} status change{changesThisWeek === 1 ? '' : 's'} in the last 7 days</span>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'auto' }}>
        <table className="data-table" style={{ minWidth: 1300 }}>
          <thead>
            <tr>
              <th style={{ width: 28 }}></th>
              <th style={{ minWidth: 240 }}>Item / PR No.</th>
              <th style={{ textAlign: 'center', minWidth: 104, borderBottom: `3px solid ${STATUS_WEB['RFQ created'].bg}` }}>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>Step 1</div>Request / RFQ Created
              </th>
              {STAGES.map((st, i) => (
                <th key={st} style={{ textAlign: 'center', minWidth: 92, borderBottom: `3px solid ${STATUS_WEB[st].bg}` }}>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>Step {i + 2}</div>{SHORT[st]}
                </th>
              ))}
              <th style={{ textAlign: 'center' }}>{view === 'pending' ? 'Days open' : 'Total days'}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ r, a }) => {
              const isOpen = open === r.id;
              let prevDate: Date | undefined = a.start;
              return (
                <Fragment key={r.id}>
                  <tr onClick={() => setOpen(isOpen ? null : r.id)} style={{ cursor: 'pointer', background: isOpen ? '#EEF2FF' : undefined }}>
                    <td>{isOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</td>
                    <td style={{ minWidth: 240, maxWidth: 320 }}>
                      <div style={{ fontWeight: 600, color: '#111827' }}>{r.itemDescription}</div>
                      <div style={{ fontSize: 11, color: '#60a5fa', fontFamily: 'monospace' }}>{r.prNumber}</div>
                      {a.rejectedAt && <div style={{ fontSize: 11, color: '#475569', fontWeight: 700 }}>✕ {REJECTED} · {fmt(a.rejectedAt)}</div>}
                    </td>
                    <td style={{ textAlign: 'center', padding: '6px 4px' }}>
                      {a.start ? (
                        <div title={`Requested / RFQ created: ${fmt(a.start)}`} style={{
                          display: 'inline-block', minWidth: 78, padding: '3px 6px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                          background: a.current === 'RFQ created' ? STATUS_WEB['RFQ created'].bg : '#F8FAFC',
                          color: a.current === 'RFQ created' ? '#fff' : '#1e293b', border: `1.5px solid ${STATUS_WEB['RFQ created'].bg}`,
                        }}>{fmt(a.start)}</div>
                      ) : a.current === 'RFQ created' ? (
                        <span style={{ display: 'inline-block', whiteSpace: 'nowrap', padding: '3px 8px', borderRadius: 7, fontSize: 11, fontWeight: 700, background: STATUS_WEB['RFQ created'].bg, color: '#fff' }}>Current · no date</span>
                      ) : <span style={{ color: '#e2e8f0' }}>—</span>}
                    </td>
                    {STAGES.map((st, j) => { const i = j + 1;
                      const d = a.reached.get(st);
                      const isCurrent = a.current === st;
                      const passed = !d && a.curStep > i + 1;      // earlier stage, no date logged
                      const gap = d && prevDate ? days(prevDate, d) : null;
                      if (d) prevDate = d;
                      const c = STATUS_WEB[st];
                      return (
                        <td key={st} style={{ textAlign: 'center', padding: '6px 4px' }}>
                          {d ? (
                            <div title={`${st}: ${fmtTime(d)}`} style={{
                              display: 'inline-block', minWidth: 78, padding: '3px 6px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                              background: isCurrent ? c.bg : '#F8FAFC', color: isCurrent ? '#fff' : '#1e293b',
                              border: `1.5px solid ${c.bg}`,
                            }}>
                              {fmt(d)}
                              {gap !== null && <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.8 }}>+{gap} day{gap === 1 ? '' : 's'}</div>}
                            </div>
                          ) : isCurrent ? (
                            <span title="Current stage — reached before history tracking started" style={{ display: 'inline-block', whiteSpace: 'nowrap', padding: '3px 8px', borderRadius: 7, fontSize: 11, fontWeight: 700, background: c.bg, color: '#fff' }}>Current · no date</span>
                          ) : passed ? (
                            <span title="Passed — no date recorded" style={{ color: '#94a3b8', fontSize: 13 }}>✓</span>
                          ) : (
                            <span style={{ color: '#e2e8f0' }}>—</span>
                          )}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'center', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {a.completed ? (
                        a.start && a.endAt
                          ? <span style={{ fontWeight: 700, color: a.doneAt ? '#16a34a' : '#475569' }}>{days(a.start, a.endAt)} days</span>
                          : <span style={{ color: a.current === REJECTED ? '#475569' : '#16a34a', fontWeight: 600 }} title="Completed before history tracking started">{a.current === REJECTED ? 'Rejected' : 'Received'}</span>
                      ) : a.start ? (
                        <span style={{ color: '#b45309', fontWeight: 600 }} title="Still open — days so far">{days(a.start, today)} days</span>
                      ) : '—'}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td></td>
                      <td colSpan={STAGES.length + 3} style={{ background: '#F8FAFC', padding: '10px 14px' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Status change log</div>
                        {a.log.length === 0 ? (
                          <div style={{ fontSize: 12, color: '#94a3b8' }}>
                            No changes recorded yet. Dates are recorded from now on whenever the status is changed.
                            {a.current && <> Current status: <b>{statusLabel(a.current)}</b>.</>}
                          </div>
                        ) : (
                          <table style={{ fontSize: 12, borderCollapse: 'collapse' }}>
                            <tbody>
                              {[...a.log].reverse().map((h, i) => (
                                <tr key={i}>
                                  <td style={{ padding: '3px 12px 3px 0', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtTime(h.at)}</td>
                                  <td style={{ padding: '3px 6px', color: '#94a3b8' }}>{h.from ? statusLabel(h.from) : 'New item'}</td>
                                  <td style={{ padding: '3px 6px', color: '#94a3b8' }}>→</td>
                                  <td style={{ padding: '3px 6px' }}>
                                    <span style={{ padding: '1px 8px', borderRadius: 6, fontWeight: 700, color: '#fff', background: STATUS_WEB[h.status]?.bg || '#94a3b8' }}>{statusLabel(h.status) || '— Not set —'}</span>
                                    {h.from && stepOf(h.status) && stepOf(h.from) > stepOf(h.status) && <span style={{ marginLeft: 6, color: '#dc2626', fontWeight: 600 }}>moved back</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={STAGES.length + 4} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>{view === 'pending' ? 'No pending items match.' : 'No completed items match.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8' }}>
        Dates are recorded automatically each time the Current Status changes. "+N days" = days since the previous stage (or since the request date).
        Items whose status was set before this history existed show "Current · no date" until their next change.
      </div>
    </div>
  );
}
