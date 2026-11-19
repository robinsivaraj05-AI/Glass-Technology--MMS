// Attendance sheet codes — shared by the Attendance page and the employee
// profile's Attendance History tab so both use the same labels and colours.
export interface CodeDef { code: string; label: string; bg: string; text: string; border: string; }

export const CODES: CodeDef[] = [
  { code:'PR', label:'Present',               bg:'#bbf7d0', text:'#14532d', border:'#4ade80' },
  { code:'WO', label:'Weekly Off',            bg:'#fef08a', text:'#713f12', border:'#facc15' },
  { code:'WH', label:'Work From Home',        bg:'#bae6fd', text:'#0c4a6e', border:'#38bdf8' },
  { code:'SD', label:'Special Duty',          bg:'#fed7aa', text:'#7c2d12', border:'#fb923c' },
  { code:'CO', label:'Compensate Off',        bg:'#fecaca', text:'#7f1d1d', border:'#f87171' },
  { code:'PL', label:'Planned Leave',         bg:'#e9d5ff', text:'#4c1d95', border:'#c084fc' },
  { code:'AL', label:'Annual Leave',          bg:'#fbcfe8', text:'#831843', border:'#f472b6' },
  { code:'OD', label:'On Duty',               bg:'#6ee7b7', text:'#064e3b', border:'#34d399' },
  { code:'RP', label:'Req. Permission',       bg:'#fef9c3', text:'#854d0e', border:'#fde047' },
  { code:'SL', label:'Special Leave',         bg:'#ddd6fe', text:'#3b0764', border:'#a78bfa' },
  { code:'NH', label:'National Holiday',      bg:'#e0e7ff', text:'#1e1b4b', border:'#818cf8' },
  { code:'A',  label:'First Shift',           bg:'#d1fae5', text:'#065f46', border:'#6ee7b7' },
  { code:'B',  label:'Second Shift',          bg:'#fef3c7', text:'#78350f', border:'#fbbf24' },
  { code:'C',  label:'Night Shift',           bg:'#c7d2fe', text:'#312e81', border:'#818cf8' },
];
export const CODE_MAP: Record<string, CodeDef> = Object.fromEntries(CODES.map(c => [c.code, c]));
export const WORK_CODES  = new Set(['PR','WH','SD','OD','A','B','C','RP']);
export const LEAVE_CODES = new Set(['AL','PL','SL','CO']);
export const MONTHS = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];
