import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import breakdownRoutes from './routes/breakdowns';
import employeeRoutes from './routes/employees';
import orgPositionRoutes from './routes/orgPositions';
import attendanceRoutes from './routes/attendance';
import overtimeRoutes from './routes/overtime';
import contractRoutes from './routes/contracts';
import outsourceRoutes from './routes/outsource';
import equipmentRoutes from './routes/equipment';
import equipmentEntryRoutes from './routes/equipmentEntries';
import accessoryRoutes from './routes/accessories';
import assetRoutes from './routes/assets';
import purchaseRFQRoutes from './routes/purchaseRFQ';
import purchaseFollowupRoutes from './routes/purchaseFollowup';
import purchasePORoutes from './routes/purchasePO';
import machineRoutes from './routes/machines';
import calibrationRoutes from './routes/calibration';

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok', service: 'MMS API', version: '2.0.0' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/breakdowns', breakdownRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/org-positions', orgPositionRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/overtime', overtimeRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/outsource', outsourceRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/equipment-entries', equipmentEntryRoutes);
app.use('/api/accessories', accessoryRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/purchase-rfq', purchaseRFQRoutes);
app.use('/api/purchase-followup', purchaseFollowupRoutes);
app.use('/api/purchase-po', purchasePORoutes);
app.use('/api/machines', machineRoutes);
app.use('/api/calibration', calibrationRoutes);

// 404 handler
app.use((req, res) => res.status(404).json({ message: `Route ${req.originalUrl} not found` }));

export default app;
