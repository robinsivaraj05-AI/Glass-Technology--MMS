import { Router, Request, Response } from 'express';
import OrgPosition from '../models/OrgPosition';

const router = Router();

// ── Default E&I Department Structure ──────────────────────────────────────────
// Hierarchy: Manager → Deputy Manager → [Gen E&I | Auto | IT | SE-A | SE-B | SE-C | Reliving]
//            All 4 Shift Engineers report DIRECTLY to Deputy Manager.
//            General E&I, Automation, IT Engineers are leaf nodes (no subordinates).
const SEED_POSITIONS = [
  // Level 0
  { posId:'p01', parentId:null,  role:'E & I, IT Manager',          team:'', personName:'Mr. Sathish Venmani', urgent:false, sortOrder:0, roleCategory:'Manager',             recruitmentStatus:'joined'        },
  // Level 1
  { posId:'p02', parentId:'p01', role:'E & I, Deputy Manager',      team:'', personName:'Mr. Rabin Sivaraj',   urgent:false, sortOrder:0, roleCategory:'Dy Manager',           recruitmentStatus:'joined'        },
  // Level 2 — Engineer roles (leaf nodes, no subordinates)
  { posId:'p03', parentId:'p02', role:'General E & I Engineer',     team:'', personName:'',                    urgent:false, sortOrder:0, roleCategory:'General E&I Engineer', recruitmentStatus:'pending'       },
  { posId:'p14', parentId:'p02', role:'Automation Engineer',        team:'', personName:'',                    urgent:false, sortOrder:1, roleCategory:'Automation Engineer',   recruitmentStatus:'pending'       },
  { posId:'p17', parentId:'p02', role:'IT Engineer',                team:'', personName:'Mr. Castero',          urgent:false, sortOrder:2, roleCategory:'IT Engineer',           recruitmentStatus:'joined'        },
  // Level 2 — Four Shift Engineers, all reporting directly to Deputy Manager
  { posId:'p04', parentId:'p02', role:'Shift Engineer',             team:'Team A',    personName:'Mr. Praveen Kumar',         urgent:false, sortOrder:3, roleCategory:'Shift Engineer', recruitmentStatus:'joined'        },
  { posId:'p07', parentId:'p02', role:'Shift Engineer',             team:'Team B',    personName:'Mr. Hari Krishna',          urgent:false, sortOrder:4, roleCategory:'Shift Engineer', recruitmentStatus:'joined'        },
  { posId:'p10', parentId:'p02', role:'Shift Engineer',             team:'Team C',    personName:'Mr. Arun',                  urgent:false, sortOrder:5, roleCategory:'Shift Engineer', recruitmentStatus:'joined'        },
  { posId:'p13', parentId:'p02', role:'Reliving Shift Engineer',    team:'',          personName:'',                          urgent:true,  sortOrder:6, roleCategory:'Shift Engineer', recruitmentStatus:'ready_to_join' },
  // Level 3 — Sub-roles under each Shift Engineer
  { posId:'p05', parentId:'p04', role:'Junior Shift Engineer',      team:'Team A', personName:'Mr. Vivek Surendra Singh', urgent:false, sortOrder:0, roleCategory:'Junior Engineer', recruitmentStatus:'joined'  },
  { posId:'p08', parentId:'p07', role:'Junior Shift Engineer',      team:'Team B', personName:'Mr. Mohit Thalaviya',      urgent:false, sortOrder:0, roleCategory:'Junior Engineer', recruitmentStatus:'joined'  },
  { posId:'p11', parentId:'p10', role:'Junior Shift Engineer',      team:'Team C', personName:'Mr. Aniket',               urgent:false, sortOrder:0, roleCategory:'Junior Engineer', recruitmentStatus:'joined'  },
  { posId:'p15', parentId:'p13', role:'Team Member',                team:'Reliving', personName:'',                       urgent:false, sortOrder:0, roleCategory:'Technician',      recruitmentStatus:'pending' },
  // Level 4 — Team Members
  { posId:'p06', parentId:'p05', role:'Team Member', team:'Team A',   personName:'Mr. Krishna', urgent:false, sortOrder:0, roleCategory:'Technician', recruitmentStatus:'joined'  },
  { posId:'p09', parentId:'p08', role:'Team Member', team:'Team B',   personName:'Mr. Rajan',   urgent:false, sortOrder:0, roleCategory:'Technician', recruitmentStatus:'joined'  },
  { posId:'p12', parentId:'p11', role:'Team Member', team:'Team C',   personName:'',            urgent:false, sortOrder:0, roleCategory:'Technician', recruitmentStatus:'pending' },
  { posId:'p16', parentId:'p15', role:'Team Member', team:'Reliving', personName:'',            urgent:false, sortOrder:0, roleCategory:'Technician', recruitmentStatus:'pending' },
];

// GET all positions
router.get('/', async (_req: Request, res: Response) => {
  try {
    const positions = await OrgPosition.find().sort({ sortOrder: 1 }).lean();
    res.json(positions);
  } catch {
    res.status(500).json({ message: 'Failed to fetch org positions' });
  }
});

// POST seed — insert default structure if DB is empty
router.post('/seed', async (_req: Request, res: Response) => {
  try {
    const count = await OrgPosition.countDocuments();
    if (count > 0) return res.json({ message: 'Already seeded', count });
    await OrgPosition.insertMany(SEED_POSITIONS);
    res.status(201).json({ message: 'Seeded successfully', count: SEED_POSITIONS.length });
  } catch (err: any) {
    res.status(500).json({ message: 'Seed failed', error: err.message });
  }
});

// POST reset — clear all positions and re-seed with default structure
router.post('/reset', async (_req: Request, res: Response) => {
  try {
    await OrgPosition.deleteMany({});
    await OrgPosition.insertMany(SEED_POSITIONS);
    res.status(201).json({ message: 'Reset successfully', count: SEED_POSITIONS.length });
  } catch (err: any) {
    res.status(500).json({ message: 'Reset failed', error: err.message });
  }
});

// POST fix-vacancies — clear urgent flag on any Team Member that was accidentally re-added as urgent
router.post('/fix-vacancies', async (_req: Request, res: Response) => {
  try {
    const result = await OrgPosition.updateMany(
      { role: 'Team Member', urgent: true, personName: '' },
      { $set: { urgent: false } }
    );
    res.json({ fixed: result.modifiedCount });
  } catch (err: any) {
    res.status(500).json({ message: 'Fix failed', error: err.message });
  }
});

// POST fix-tree — fix Team B Team Member parentId so it sits directly under Team B Junior Shift Engineer
router.post('/fix-tree', async (_req: Request, res: Response) => {
  try {
    const all = await OrgPosition.find().lean();

    // Find key anchors
    const teamBSE  = all.find(p => p.role === 'Shift Engineer'       && p.team === 'Team B');
    const teamBJSE = all.find(p => p.role === 'Junior Shift Engineer' && p.team === 'Team B');
    if (!teamBJSE) return res.json({ fixed: 0, message: 'Team B Junior Shift Engineer not found' });

    // Team Members that belong to Team B but are NOT under the JSE (wrong parent)
    const wrong = all.filter(p =>
      p.role === 'Team Member' &&
      p.team === 'Team B' &&
      p.parentId !== teamBJSE.posId
    );

    let fixed = 0;
    for (const pos of wrong) {
      await OrgPosition.findOneAndUpdate(
        { posId: pos.posId },
        { $set: { parentId: teamBJSE.posId, sortOrder: 0, urgent: false } }
      );
      fixed++;
    }

    // If no Team B Team Member exists at all under JSE, create one
    const existing = all.find(p => p.role === 'Team Member' && p.team === 'Team B' && p.parentId === teamBJSE.posId);
    if (!existing && fixed === 0) {
      const count = await OrgPosition.countDocuments();
      const newPos = new OrgPosition({
        posId: `pos-tb-member-${Date.now()}`,
        parentId: teamBJSE.posId,
        role: 'Team Member',
        team: 'Team B',
        personName: '',
        urgent: false,
        sortOrder: 0,
        roleCategory: 'Technician',
        recruitmentStatus: 'pending',
        department: teamBSE?.department || '',
      });
      await newPos.save();
      fixed = 1;
    }

    res.json({ fixed, message: `Fixed ${fixed} Team B Team Member position(s)` });
  } catch (err: any) {
    res.status(500).json({ message: 'Fix tree failed', error: err.message });
  }
});

// POST clear-person — clear personName from org positions when an employee resigns
router.post('/clear-person', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'name is required' });
    const result = await OrgPosition.updateMany(
      { personName: { $regex: name.trim(), $options: 'i' } },
      { $set: { personName: '', recruitmentStatus: 'pending' } }
    );
    res.json({ cleared: result.modifiedCount });
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to clear person', error: err.message });
  }
});

// POST add new position
router.post('/', async (req: Request, res: Response) => {
  try {
    // Generate unique posId
    const count = await OrgPosition.countDocuments();
    const posId = req.body.posId || `pos-${Date.now()}-${count}`;
    const pos = new OrgPosition({ ...req.body, posId });
    await pos.save();
    res.status(201).json(pos.toObject());
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to add position', error: err.message });
  }
});

// PATCH update position (fill name, link employee, mark urgent, etc.)
router.patch('/:posId', async (req: Request, res: Response) => {
  try {
    const pos = await OrgPosition.findOneAndUpdate(
      { posId: req.params.posId },
      { $set: req.body },
      { new: true }
    ).lean();
    if (!pos) return res.status(404).json({ message: 'Position not found' });
    res.json(pos);
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to update position', error: err.message });
  }
});

// DELETE position (and optionally its children)
router.delete('/:posId', async (req: Request, res: Response) => {
  try {
    // Cascade: delete all descendants
    const toDelete = new Set<string>([req.params.posId]);
    const all = await OrgPosition.find().lean();
    let changed = true;
    while (changed) {
      changed = false;
      all.forEach(p => {
        if (p.parentId && toDelete.has(p.parentId) && !toDelete.has(p.posId)) {
          toDelete.add(p.posId);
          changed = true;
        }
      });
    }
    await OrgPosition.deleteMany({ posId: { $in: Array.from(toDelete) } });
    res.json({ message: 'Deleted', count: toDelete.size });
  } catch {
    res.status(500).json({ message: 'Failed to delete position' });
  }
});

export default router;
