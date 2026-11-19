import User from '../models/User';

// The app used to check these four logins in the browser. On first start
// with the new server-side login, create them as real accounts (hashed
// passwords) so everyone can still sign in, and flag them so the app asks
// each user to change the password.
//
// Set SEED_PASSWORD_MANAGER / _DEPUTY / _SHIFT / _GUEST in the server
// environment to use different initial passwords. Existing accounts are
// never touched.
const INITIAL_USERS = [
  { email: 'manager@mms.com', name: 'Senthil Babu',  role: 'manager',        employeeId: 'EMP-000', env: 'SEED_PASSWORD_MANAGER', fallback: 'mgr@2026', department: 'Electrical & Instrumentation, IT' },
  { email: 'deputy@mms.com',  name: 'Rabin Sivaraj', role: 'deputy_manager', employeeId: 'EMP-001', env: 'SEED_PASSWORD_DEPUTY',  fallback: 'dm@2026',  department: 'Electrical & Instrumentation, IT' },
  { email: 'shift@mms.com',   name: 'Arun Selvam',   role: 'shift_engineer', employeeId: 'EMP-002', env: 'SEED_PASSWORD_SHIFT',   fallback: 'se@2026',  department: 'Electrical & Instrumentation' },
  { email: 'guest@mms.com',   name: 'Guest User',    role: 'guest',          employeeId: 'EMP-005', env: 'SEED_PASSWORD_GUEST',   fallback: 'guest123', department: 'General' },
] as const;

export async function seedUsers() {
  for (const u of INITIAL_USERS) {
    try {
      if (await User.exists({ email: u.email })) continue;
      const fromEnv = process.env[u.env];
      await User.create({
        email: u.email, name: u.name, role: u.role, employeeId: u.employeeId, department: u.department,
        password: fromEnv || u.fallback,
        mustChangePassword: true,
      });
      console.log(`👤 Created login ${u.email} (${u.role})${fromEnv ? '' : ' with the previous default password — change it after first login'}`);
    } catch (err: any) {
      console.error(`❌ Could not create login ${u.email}:`, err.message);
    }
  }
}
