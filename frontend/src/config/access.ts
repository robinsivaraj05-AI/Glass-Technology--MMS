// Which pages each role may open, and where it may only look.
// Manager and Deputy Manager: everything. User (guest): everything, read-only (server enforced).
// Engineer: only the pages below. Change these lists to fine-tune access.
import type { UserRole } from '../types';

const ENGINEER_PAGES = [
  '/dashboard',
  '/contractor/entry', '/contractor/report',                      // Outsource: work entry & cost report
  '/rental/entry', '/rental/accessories', '/rental/report',       // Rental equipment: work entry, accessories, cost report
  '/purchase/rfq',                                                // Purchase: RFQ creation
  '/purchase/followup',                                           // E&I Purchase Status — view only
  '/notifications', '/settings',                                  // own notifications, change password
];
const ENGINEER_VIEW_ONLY = ['/purchase/followup'];

const matches = (list: string[], path: string) => list.some(p => path === p || path.startsWith(p + '/'));

/** May this role open the page at `path`? */
export function canSeePage(role: UserRole | undefined, path: string): boolean {
  if (role === 'shift_engineer') return matches(ENGINEER_PAGES, path);
  return true;
}

/** Is this page view-only for this role? */
export function isViewOnly(role: UserRole | undefined, path: string): boolean {
  if (role === 'guest') return true;
  if (role === 'shift_engineer') return matches(ENGINEER_VIEW_ONLY, path);
  return false;
}
