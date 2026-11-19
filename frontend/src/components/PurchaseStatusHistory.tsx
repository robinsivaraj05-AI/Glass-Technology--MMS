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
const days = (a: Date, b: Date) => Math.max(0, Math.round((b.getTime() - a.getTime()) / DAY));
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
  const start = r.requestDate ? new Date(r.requestDate) : log[0]?.at;
  const doneAt = reached.get('Material Received');
  return { log, reached, current, curStep, rejectedAt, lastChange, start, doneAt };
}

export default function PurchaseStatusHistory({ records }: { records: Rec[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => records
    .map(r => ({ r, a: analyse(r) }))
    .sort((x, y) => (y.a.lastChange?.getTime() ?? 0) - (x.a.lastChange?.getTime() ?? 0)), [records]);

  const weekAgo = Date.now() - 7 * DAY;
  const changesThisWeek = rows.reduce((n, { a }) => n + a.log.filter(h => h.at.getTime() >= weekAgo).length, 0);
  const atStage = (st: string) => rows.filter(({ a }) => a.current === st).length;
  const today = new Date();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Where items are now */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <History size={16} color="#6366f1"/>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginRight: 4 }}>Items at each stage</span>
        {[...STATUS_FLOW, REJECTED].map(st => (
          <span key={st} title={st} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: STATUS_WEB[st]?.bg, color: '#fff' }}>
            {statusLabel(st).replace(/^(\d+)\. .*/, '$1')}{isRejected(st) ? '✕' : ''} {SHORT[st] || 'Rejected'} <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 10, padding: '0 6px' }}>{atStage(st)}</span>
          </span>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b' }}>{changesThisWeek} status change{changesThisWeek === 1 ? '' : 's'} in the last 7 days</span>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'auto' }}>
        <table className="data-table" style={{ minWidth: 1400 }}>
          <thead>
            <tr>
              <th style={{ width: 28 }}></th>
              <th style={{ minWidth: 240 }}>Item / PR No.</th>
              <th style={{ whiteSpace: 'nowrap' }}>Request</th>
              {STATUS_FLOW.map((st, i) => (
                <th key={st} style={{ textAlign: 'center', minWidth: 92, borderBottom: `3px solid ${STATUS_WEB[st].bg}` }}>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>Step {i + 1}</div>{SHORT[st]}
                </th>
              ))}
              <th style={{ textAlign: 'center' }}>Total days</th>
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
                    <td style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{a.start ? fmt(a.start) : '—'}</td>
                    {STATUS_FLOW.map((st, i) => {
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
                      {a.current === 'Material Received' && !a.doneAt ? (
                        <span style={{ color: '#16a34a', fontWeight: 600 }} title="Received before history tracking started">Received</span>
                      ) : a.start ? (
                        a.doneAt
                          ? <span style={{ fontWeight: 700, color: '#16a34a' }}>{days(a.start, a.doneAt)} days</span>
                          : <span style={{ color: '#b45309', fontWeight: 600 }} title="Still open — days so far">{days(a.start, a.rejectedAt ?? today)}{a.rejectedAt ? '' : '+'} days</span>
                      ) : '—'}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td></td>
                      <td colSpan={STATUS_FLOW.length + 3} style={{ background: '#F8FAFC', padding: '10px 14px' }}>
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
              <tr><td colSpan={STATUS_FLOW.length + 4} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>No items match.</td></tr>
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
