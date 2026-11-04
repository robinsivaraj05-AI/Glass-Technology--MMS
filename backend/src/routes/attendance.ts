import { Router } from 'express';
import AttendanceRecord from '../models/Attendance';
import TeamMember from '../models/TeamMember';
import Employee from '../models/Employee';

const router = Router();

// Seed data — loaded once if DB has no team members
const SEED_TEAM = [
  { empId: 'GT020', empName: 'Mr. Rabin Sivaraj',   role: 'E & I Deputy Manager', sortOrder: 1 },
  { empId: 'GT026', empName: 'Mr. Praveen Kumar',    role: 'Shift Engineer - A',   sortOrder: 2 },
  { empId: 'GT051', empName: 'Mr. Hari Krishna',     role: 'Shift Engineer - B',   sortOrder: 3 },
  { empId: 'GT062', empName: 'Mr. Arun',             role: 'Shift Engineer - C',   sortOrder: 4 },
  { empId: 'GT035', empName: 'Mr. Mohit S Talaviya', role: 'Junior Engineer',       sortOrder: 5 },
  { empId: 'GT033', empName: 'Mr. Vivek Singh',      role: 'Junior Engineer - A',  sortOrder: 6 },
  { empId: 'GT074', empName: 'Mr. Aniket',           role: 'Junior Engineer - B',  sortOrder: 7 },
  { empId: 'GT046', empName: 'Mr. Ravi Kannan',      role: 'Technician',           sortOrder: 8 },
  { empId: 'GT053', empName: 'Mr. Krishna',          role: 'Technician',           sortOrder: 9 },
  { empId: 'GT069', empName: 'Mr. Casetro',          role: 'IT Engineer',          sortOrder: 10 },
];

// ── Team routes ───────────────────────────────────────────────────────────────

// GET /api/attendance/team
router.get('/team', async (_req, res) => {
  try {
    let members = await TeamMember.find().sort({ sortOrder: 1 });
    if (members.length === 0) {
      await TeamMember.insertMany(SEED_TEAM);
      members = await TeamMember.find().sort({ sortOrder: 1 });
    }
    // One-time fixes: correct stale role labels
    await TeamMember.findOneAndUpdate(
      { empId: 'GT035', role: 'Reliving Shift Eng' },
      { $set: { role: 'Junior Engineer' } }
    );
    await TeamMember.findOneAndUpdate(
      { empId: 'GT046', role: 'Junior Engineer - C' },
      { $set: { role: 'Technician' } }
    );
    members = await TeamMember.find().sort({ sortOrder: 1 });

    // Remove any team members who are now marked resigned in the Employee collection
    // Match by empId OR by name to catch all cases
    const resignedEmps = await Employee.find({ status: 'resigned' }).lean().select('empId name');
    const resignedEmpIds  = new Set(resignedEmps.map((e: any) => e.empId).filter(Boolean));
    const resignedNames   = new Set(resignedEmps.map((e: any) => (e.name || '').toLowerCase().trim()).filter(Boolean));
    const stale = members.filter(m =>
      resignedEmpIds.has(m.empId) ||
      resignedNames.has(m.empName.toLowerCase().trim())
    );
    if (stale.length > 0) {
      await TeamMember.deleteMany({ empId: { $in: stale.map(m => m.empId) } });
      const staleIds = new Set(stale.map(m => m.empId));
      members = members.filter(m => !staleIds.has(m.empId));
    }

    res.json(members);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// PATCH /api/attendance/team/:empId — update member fields
router.patch('/team/:empId', async (req, res) => {
  try {
    const member = await TeamMember.findOneAndUpdate(
      { empId: req.params.empId },
      { $set: req.body },
      { new: true }
    );
    if (!member) return res.status(404).json({ error: 'Member not found' });
    res.json(member);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// POST /api/attendance/team — add new member
router.post('/team', async (req, res) => {
  try {
    const { empId, empName, role } = req.body;
    if (!empId || !empName || !role)
      return res.status(400).json({ error: 'empId, empName, role are required' });
    const last = await TeamMember.findOne().sort({ sortOrder: -1 }).lean();
    const member = await TeamMember.create({
      empId: empId.trim(), empName: empName.trim(), role: role.trim(),
      sortOrder: last ? last.sortOrder + 1 : 1,
    });
    res.json(member);
  } catch (err: any) {
    if (err.code === 11000) return res.status(409).json({ error: 'Employee ID already exists' });
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/attendance/team/:empId — remove member
router.delete('/team/:empId', async (req, res) => {
  try {
    await TeamMember.findOneAndDelete({ empId: req.params.empId });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ── Attendance routes ─────────────────────────────────────────────────────────

// GET /api/attendance?year=&month=
router.get('/', async (req, res) => {
  try {
    const year  = parseInt(req.query.year  as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || (new Date().getMonth() + 1);
    const records = await AttendanceRecord.find({ year, month });
    res.json(records);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// GET /api/attendance/yearly?year=  — all 12 months aggregated
router.get('/yearly', async (req, res) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const records = await AttendanceRecord.find({ year });
    // Merge entries per employee across all months, using "month_day" as virtual key
    const merged: Record<string, Array<{ day: number; code: string }>> = {};
    records.forEach(rec => {
      if (!merged[rec.empId]) merged[rec.empId] = [];
      const arr = merged[rec.empId]!;
      rec.entries.forEach(e => arr.push({ day: rec.month * 100 + e.day, code: e.code }));
    });
    const result = Object.entries(merged).map(([empId, entries]) => ({ empId, entries }));
    res.json(result);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// PUT /api/attendance — bulk save { year, month, records[] }
router.put('/', async (req, res) => {
  try {
    const { year, month, records } = req.body as {
      year: number; month: number;
      records: Array<{ empId: string; empName: string; entries: Array<{ day: number; code: string; remark?: string }> }>;
    };
    if (!year || !month || !Array.isArray(records))
      return res.status(400).json({ error: 'year, month, and records[] required' });
    await Promise.all(
      records.map(r =>
        AttendanceRecord.findOneAndUpdate(
          { empId: r.empId, year, month },
          { $set: { entries: r.entries, empName: r.empName } },
          { upsert: true }
        )
      )
    );
    res.json({ ok: true, saved: records.length });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// PUT /api/attendance/:empId — single employee upsert
router.put('/:empId', async (req, res) => {
  try {
    const { year, month, entries, empName } = req.body;
    const record = await AttendanceRecord.findOneAndUpdate(
      { empId: req.params.empId, year, month },
      { $set: { entries, empName } },
      { new: true, upsert: true }
    );
    res.json(record);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

export default router;
