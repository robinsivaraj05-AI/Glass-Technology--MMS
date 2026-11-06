// Department identity — set these in Vercel → Project Settings → Environment Variables
// Each department deployment overrides these; defaults keep the E&I app working as-is.
export const DEPT_ABBR    = import.meta.env.VITE_DEPT_ABBR    || 'E&I';
export const DEPT_NAME    = import.meta.env.VITE_DEPT_NAME    || 'E & I';
export const COMPANY_NAME = import.meta.env.VITE_COMPANY_NAME || 'Glass Technology (MENA) L.L.C';
export const COMPANY_LOC  = import.meta.env.VITE_COMPANY_LOC  || 'Sharjah, UAE';
