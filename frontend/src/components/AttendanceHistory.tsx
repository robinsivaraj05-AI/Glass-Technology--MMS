import { useEffect, useMemo, useState, Fragment } from 'react';
import { ChevronDown, ChevronRight, CalendarDays, CalendarRange, RefreshCw } from 'lucide-react';
import { apiFetch } from '../utils/api';
import { CODES, CODE_MAP, WORK_CODES, LEAVE_CODES, MONTHS } from '../config/attendanceCodes';

// Read-only view of one employee's rows from the Attendance sheet,
// summarised month-wise (per year) and year-wise.

interface Entry { day: number; code: string; remark?: string; }
interface MonthRecord { empId: string; empName: string; year: number; month: number; entries: Entry[]; }

interface Totals {
  counts: Record<string, number>;  // per attendance code
  working: number; leave: number; weeklyOff: number; holiday: number; recorded: number;
}

function tally(entries: Entry[]): Totals {
  const t: Totals = { counts: {}, working: 0, leave: 0, weeklyOff: 0, holiday: 0, recorded: 0 };
  for (const e of entries) {
    if (!e.code) continue;
    t.counts[e.code] = (t.counts[e.code] || 0) + 1;
    t.recorded++;
    if (WORK_CODES.has(e.code)) t.working++;
    else if (LEAVE_CODES.has(e.code)) t.leave++;
    else if (e.code === 'WO') t.weeklyOff++;
    else if (e.code === 'NH') t.holiday++;
  }
  return t;
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function CodeChip({ code, count }: { code: string; count?: number }) {
  const d = CODE_MAP[code];
  return (
    <span title={d?.label || code} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 28, padding: '2px 7px',
      borderRadius: 6, fontSize: 12, fontWeight: 700, background: d?.bg || '#f1f5f9', color: d?.text || '#334155',
      border: `1px solid ${d?.border || '#cbd5e1'}`,
    }}>
      {count !== undefined ? count : code}
    </span>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="glass-card" style={{ padding: '12px 14px', borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default function AttendanceHistory({ empId, name }: { empId: string; name: string }) {
  const [records, setRecords] = useState<MonthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'month' | 'year'>('month');
  const [year, setYear] = useState<number | null>(null);
  const [openMonth, setOpenMonth] = useState<number | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    apiFetch(`/api/attendance/employee/${encodeURIComponent(empId)}?name=${encodeURIComponent(name)}`)
      .then((data: MonthRecord[]) => { if (!cancelled) setRecords(Array.isArray(data) ? data : []); })
      .catch((e: any) => { if (!cancelled) setError(e?.message || 'Failed to load attendance'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [empId, name, reload]);

  const years = useMemo(() => [...new Set(records.map(r => r.year))].sort((a, b) => b - a), [records]);
  useEffect(() => { if (years.length && (year === null || !years.includes(year))) setYear(years[0]); }, [years, year]);

  const monthRows = useMemo(() => records
    .filter(r => r.year === year)
    .sort((a, b) => a.month - b.month)
    .map(r => ({ rec: r, t: tally(r.entries || []) })), [records, year]);

  const yearRows = useMemo(() => years.map(y => {
    const recs = records.filter(r => r.year === y);
    return { year: y, months: recs.length, t: tally(recs.flatMap(r => r.entries || [])) };
  }), [records, years]);

  const shown = view === 'month' ? tally(monthRows.flatMap(m => m.rec.entries || [])) : tally(records.flatMap(r => r.entries || []));
  // Per-code columns: only codes that actually occur, in the sheet's own order.
  // WO and NH already have their own "Weekly Off" / "Holiday" columns.
  const usedCodes = CODES.map(c => c.code).filter(c => c !== 'WO' && c !== 'NH' && (shown.counts[c] || 0) > 0);

  const toggleBtn = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    border: 'none', borderRadius: 7, background: active ? '#3b82f6' : 'transparent', color: active ? '#fff' : '#475569',
  });
  const num = (n: number, color = '#334155') => <span style={{ fontWeight: 700, color: n ? color : '#cbd5e1' }}>{n}</span>;

  if (loading) return <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: '#64748b', fontSize: 13 }}>Loading attendance…</div>;
  if (error) return (
    <div className="glass-card" style={{ padding: 32, textAlign: 'center', color: '#b91c1c', fontSize: 13 }}>
      Could not load attendance: {error}
      <div><button onClick={() => setReload(x => x + 1)} style={{ marginTop: 10, fontSize: 12, padding: '6px 12px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}><RefreshCw size={12}/> Retry</button></div>
    </div>
  );
  if (!records.length) return (
    <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: '#475569', fontSize: 13 }}>
      <CalendarDays size={32} color="#cbd5e1" style={{ marginBottom: 8 }}/>
      <div style={{ fontWeight: 600 }}>No attendance found for {name} ({empId}).</div>
      <div style={{ color: '#94a3b8', marginTop: 4 }}>Attendance appears here once this employee is marked in the Attendance sheet.</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 2, background: '#f1f5f9', padding: 3, borderRadius: 9 }}>
          <button style={toggleBtn(view === 'month')} onClick={() => setView('month')}><CalendarDays size={13}/> Month-wise</button>
          <button style={toggleBtn(view === 'year')} onClick={() => setView('year')}><CalendarRange size={13}/> Year-wise</button>
        </div>
        {view === 'month' && (
          <select value={year ?? ''} onChange={e => { setYear(Number(e.target.value)); setOpenMonth(null); }}
            style={{ height: 34, padding: '0 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, fontWeight: 600, color: '#1e293b', background: '#fff' }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>Source: Attendance sheet · read-only</span>
      </div>

      {/* Summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
        <Stat label={view === 'month' ? `Working days ${year}` : 'Working days (all)'} value={shown.working} color="#16a34a"/>
        <Stat label="Leave days" value={shown.leave} color="#9333ea"/>
        <Stat label="Weekly off" value={shown.weeklyOff} color="#ca8a04"/>
        <Stat label="Holidays" value={shown.holiday} color="#4f46e5"/>
        <Stat label="Days recorded" value={shown.recorded} color="#0f172a"/>
        <Stat label={view === 'month' ? 'Months recorded' : 'Years recorded'} value={view === 'month' ? monthRows.length : years.length} color="#2563eb"/>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow: 'auto', padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>{view === 'month' ? 'Month' : 'Year'}</th>
              {view === 'year' && <th style={{ textAlign: 'center' }}>Months</th>}
              <th style={{ textAlign: 'center' }}>Working</th>
              <th style={{ textAlign: 'center' }}>Leave</th>
              <th style={{ textAlign: 'center' }}>Weekly Off</th>
              <th style={{ textAlign: 'center' }}>Holiday</th>
              {usedCodes.map(c => <th key={c} style={{ textAlign: 'center' }} title={CODE_MAP[c]?.label}>{c}</th>)}
              <th style={{ textAlign: 'center' }}>Recorded</th>
            </tr>
          </thead>
          <tbody>
            {view === 'month' && monthRows.map(({ rec, t }) => {
              const open = openMonth === rec.month;
              const days = new Date(rec.year, rec.month, 0).getDate();
              const byDay = new Map((rec.entries || []).map(e => [e.day, e]));
              const remarks = (rec.entries || []).filter(e => e.remark && e.remark.trim()).sort((a, b) => a.day - b.day);
              return (
                <Fragment key={rec.month}>
                  <tr onClick={() => setOpenMonth(open ? null : rec.month)} style={{ cursor: 'pointer', background: open ? '#eff6ff' : undefined }}>
                    <td style={{ fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {open ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}{MONTHS[rec.month - 1]}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>{num(t.working, '#16a34a')}</td>
                    <td style={{ textAlign: 'center' }}>{num(t.leave, '#9333ea')}</td>
                    <td style={{ textAlign: 'center' }}>{num(t.weeklyOff, '#ca8a04')}</td>
                    <td style={{ textAlign: 'center' }}>{num(t.holiday, '#4f46e5')}</td>
                    {usedCodes.map(c => <td key={c} style={{ textAlign: 'center' }}>{t.counts[c] ? <CodeChip code={c} count={t.counts[c]}/> : num(0)}</td>)}
                    <td style={{ textAlign: 'center', color: '#64748b', fontSize: 12 }}>{t.recorded} / {days}</td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={6 + usedCodes.length} style={{ background: '#f8fafc', padding: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(54px, 1fr))', gap: 6 }}>
                          {Array.from({ length: days }, (_, i) => i + 1).map(d => {
                            const e = byDay.get(d);
                            const def = e?.code ? CODE_MAP[e.code] : null;
                            const wd = new Date(rec.year, rec.month - 1, d).getDay();
                            return (
                              <div key={d} title={[def?.label || e?.code, e?.remark].filter(Boolean).join(' — ') || 'Not marked'} style={{
                                borderRadius: 7, padding: '4px 0', textAlign: 'center', position: 'relative',
                                background: def?.bg || '#fff', border: `1px solid ${def?.border || '#e2e8f0'}`, color: def?.text || '#94a3b8',
                              }}>
                                <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.75 }}>{d} {WEEKDAY[wd]}</div>
                                <div style={{ fontSize: 13, fontWeight: 800 }}>{e?.code || '—'}</div>
                                {e?.remark?.trim() && <span style={{ position: 'absolute', top: 3, right: 4, width: 6, height: 6, borderRadius: '50%', background: '#f97316' }}/>}
                              </div>
                            );
                          })}
                        </div>
                        {remarks.length > 0 && (
                          <div style={{ marginTop: 10, fontSize: 12, color: '#475569' }}>
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>Remarks</div>
                            {remarks.map(r => <div key={r.day}>• {r.day} {MONTHS[rec.month - 1].slice(0, 3)} ({r.code}): {r.remark}</div>)}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {view === 'year' && yearRows.map(({ year: y, months, t }) => (
              <tr key={y} onClick={() => { setYear(y); setView('month'); setOpenMonth(null); }} style={{ cursor: 'pointer' }} title={`Open ${y} month-wise`}>
                <td style={{ fontWeight: 700, color: '#111827' }}>{y}</td>
                <td style={{ textAlign: 'center', color: '#64748b' }}>{months}</td>
                <td style={{ textAlign: 'center' }}>{num(t.working, '#16a34a')}</td>
                <td style={{ textAlign: 'center' }}>{num(t.leave, '#9333ea')}</td>
                <td style={{ textAlign: 'center' }}>{num(t.weeklyOff, '#ca8a04')}</td>
                <td style={{ textAlign: 'center' }}>{num(t.holiday, '#4f46e5')}</td>
                {usedCodes.map(c => <td key={c} style={{ textAlign: 'center' }}>{t.counts[c] ? <CodeChip code={c} count={t.counts[c]}/> : num(0)}</td>)}
                <td style={{ textAlign: 'center', color: '#64748b', fontSize: 12 }}>{t.recorded}</td>
              </tr>
            ))}
          </tbody>
          {(view === 'month' ? monthRows.length > 1 : yearRows.length > 1) && (
            <tfoot>
              <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
                <td style={{ padding: '10px 16px' }}>Total</td>
                {view === 'year' && <td style={{ textAlign: 'center' }}>{records.length}</td>}
                <td style={{ textAlign: 'center', color: '#16a34a' }}>{shown.working}</td>
                <td style={{ textAlign: 'center', color: '#9333ea' }}>{shown.leave}</td>
                <td style={{ textAlign: 'center', color: '#ca8a04' }}>{shown.weeklyOff}</td>
                <td style={{ textAlign: 'center', color: '#4f46e5' }}>{shown.holiday}</td>
                {usedCodes.map(c => <td key={c} style={{ textAlign: 'center' }}>{shown.counts[c] || 0}</td>)}
                <td style={{ textAlign: 'center', color: '#64748b', fontSize: 12 }}>{shown.recorded}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: 11, color: '#64748b' }}>
        <span><b style={{ color: '#16a34a' }}>Working</b> = PR, WH, SD, OD, RP, A, B, C</span>
        <span><b style={{ color: '#9333ea' }}>Leave</b> = AL, PL, SL, CO</span>
        {view === 'month' && <span>Click a month to see each day</span>}
        {view === 'year' && <span>Click a year to open it month-wise</span>}
      </div>
    </div>
  );
}
