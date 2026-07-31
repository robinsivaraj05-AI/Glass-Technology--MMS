import type { Machine, PMSchedule, Breakdown, WorkOrder, Asset, SpareItem, Project, KPIData, EnergyData, Notification } from '../types';

export const mockUser = {
  id: '1',
  name: 'Rajesh Kumar',
  email: 'rajesh.kumar@company.com',
  role: 'deputy_manager' as const,
  department: 'Electrical & Instrumentation',
  employeeId: 'EMP-001',
  shift: 'General',
};

export const mockKPIs: KPIData = {
  oee: 87.4,
  mtbf: 142,
  mttr: 3.2,
  pmCompliance: 94.6,
  breakdownPct: 2.8,
  energyCost: 2847650,
  maintenanceCost: 485000,
  powerFactor: 0.94,
  electricalAvailability: 98.7,
  instrumentationAvailability: 97.3,
  budgetUtilization: 72.4,
  labourEfficiency: 91.2,
};

export const mockMachines: Machine[] = [
  { id: '1', code: 'MCH-001', name: 'CNC Machining Center', department: 'Production', location: 'Shop Floor A', manufacturer: 'DMG Mori', serialNumber: 'DMG-2019-4521', installationDate: '2019-03-15', criticality: 'critical', status: 'running', availability: 96.2 },
  { id: '2', code: 'MCH-002', name: 'Injection Moulding Machine', department: 'Plastics', location: 'Shop Floor B', manufacturer: 'Engel', serialNumber: 'ENG-2020-1234', installationDate: '2020-06-10', criticality: 'high', status: 'running', availability: 94.8 },
  { id: '3', code: 'MCH-003', name: 'Hydraulic Press', department: 'Pressing', location: 'Shop Floor C', manufacturer: 'Schuler', serialNumber: 'SCH-2018-5678', installationDate: '2018-11-20', criticality: 'high', status: 'breakdown', availability: 78.5 },
  { id: '4', code: 'MCH-004', name: 'Conveyor System', department: 'Assembly', location: 'Assembly Line 1', manufacturer: 'Bosch', serialNumber: 'BSH-2021-9012', installationDate: '2021-01-08', criticality: 'medium', status: 'maintenance', availability: 91.3 },
  { id: '5', code: 'MCH-005', name: 'Air Compressor', department: 'Utility', location: 'Utility Room', manufacturer: 'Atlas Copco', serialNumber: 'ATC-2017-3456', installationDate: '2017-07-22', criticality: 'critical', status: 'running', availability: 99.1 },
  { id: '6', code: 'MCH-006', name: 'Welding Robot', department: 'Fabrication', location: 'Fab Shop', manufacturer: 'ABB', serialNumber: 'ABB-2022-7890', installationDate: '2022-03-14', criticality: 'high', status: 'running', availability: 97.6 },
  { id: '7', code: 'MCH-007', name: 'Laser Cutting Machine', department: 'Fabrication', location: 'Fab Shop', manufacturer: 'Trumpf', serialNumber: 'TRF-2020-2345', installationDate: '2020-09-01', criticality: 'high', status: 'running', availability: 95.4 },
  { id: '8', code: 'MCH-008', name: 'Overhead Crane 5T', department: 'Stores', location: 'Warehouse', manufacturer: 'Konecranes', serialNumber: 'KNC-2016-6789', installationDate: '2016-05-30', criticality: 'critical', status: 'idle', availability: 88.7 },
];

export const mockPMSchedules: PMSchedule[] = [
  { id: '1', machineId: '1', machineName: 'CNC Machining Center', frequency: 'monthly', nextDueDate: '2026-07-28', lastCompleted: '2026-06-28', status: 'pending', assignedTo: 'Rajan S', checklist: ['Check lubrication', 'Inspect spindle', 'Clean coolant tank', 'Check tool magazine', 'Inspect electrical panel'], priority: 'high' },
  { id: '2', machineId: '5', machineName: 'Air Compressor', frequency: 'weekly', nextDueDate: '2026-07-26', lastCompleted: '2026-07-19', status: 'overdue', assignedTo: 'Murugan K', checklist: ['Check oil level', 'Drain condensate', 'Check belt tension', 'Check safety valve'], priority: 'critical' },
  { id: '3', machineId: '2', machineName: 'Injection Moulding Machine', frequency: 'quarterly', nextDueDate: '2026-08-10', lastCompleted: '2026-05-10', status: 'pending', assignedTo: 'Selvam R', checklist: ['Inspect hydraulic system', 'Check heater bands', 'Calibrate injection pressure', 'Clean barrel'], priority: 'high' },
  { id: '4', machineId: '6', machineName: 'Welding Robot', frequency: 'monthly', nextDueDate: '2026-07-25', lastCompleted: '2026-06-25', status: 'in-progress', assignedTo: 'Arun P', checklist: ['Inspect servo motors', 'Check teach pendant', 'Lubricate joints', 'Test safety circuits'], priority: 'high' },
  { id: '5', machineId: '8', machineName: 'Overhead Crane 5T', frequency: 'monthly', nextDueDate: '2026-08-01', lastCompleted: '2026-07-01', status: 'completed', assignedTo: 'Prasad M', checklist: ['Check wire rope', 'Inspect hooks', 'Test limit switches', 'Check brakes', 'Test load cells'], priority: 'critical' },
  { id: '6', machineId: '3', machineName: 'Hydraulic Press', frequency: 'monthly', nextDueDate: '2026-07-22', lastCompleted: '2026-06-22', status: 'overdue', assignedTo: 'Kumar V', checklist: ['Check hydraulic oil', 'Inspect seals', 'Check pressure gauges', 'Inspect die cushion'], priority: 'high' },
];

export const mockBreakdowns: Breakdown[] = [
  { id: '1', ticketNo: 'BRK-2026-0342', machineId: '3', machineName: 'Hydraulic Press', reportedAt: '2026-07-25T08:30:00', problem: 'Hydraulic pressure drop causing machine stoppage', rootCause: 'Worn-out hydraulic pump seals', actionTaken: 'Replaced pump seals and hydraulic oil', downtime: 4.5, priority: 'critical', status: 'in-progress', reportedBy: 'Ramesh N', assignedTo: 'Suresh K', sparesUsed: ['Hydraulic Seal Kit', 'Hydraulic Oil 46'], cost: 12500 },
  { id: '2', ticketNo: 'BRK-2026-0341', machineId: '4', machineName: 'Conveyor System', reportedAt: '2026-07-24T14:15:00', resolvedAt: '2026-07-24T17:30:00', problem: 'Drive motor overheating and tripping', rootCause: 'Blocked motor ventilation due to dust accumulation', actionTaken: 'Cleaned motor ventilation, checked thermal relay settings', downtime: 3.25, priority: 'high', status: 'resolved', reportedBy: 'Venkat S', assignedTo: 'Kannan R', sparesUsed: ['Motor Brush Set'], cost: 3200 },
  { id: '3', ticketNo: 'BRK-2026-0340', machineId: '1', machineName: 'CNC Machining Center', reportedAt: '2026-07-23T10:00:00', resolvedAt: '2026-07-23T12:00:00', problem: 'Spindle alarm - overload fault', rootCause: 'Worn cutting tool causing excessive load', actionTaken: 'Replaced cutting tools, recalibrated spindle', downtime: 2.0, priority: 'high', status: 'closed', reportedBy: 'Karthik M', assignedTo: 'Rajan S', cost: 8500 },
  { id: '4', ticketNo: 'BRK-2026-0339', machineId: '7', machineName: 'Laser Cutting Machine', reportedAt: '2026-07-22T16:45:00', resolvedAt: '2026-07-23T09:30:00', problem: 'Laser power output reduced - quality issue', rootCause: 'Contaminated laser lens', actionTaken: 'Cleaned laser optics, realigned beam path', downtime: 5.75, priority: 'critical', status: 'closed', reportedBy: 'Anand K', assignedTo: 'Selvam R', sparesUsed: ['Lens Cleaning Kit'], cost: 4500 },
  { id: '5', ticketNo: 'BRK-2026-0338', machineId: '5', machineName: 'Air Compressor', reportedAt: '2026-07-21T07:00:00', resolvedAt: '2026-07-21T09:00:00', problem: 'Compressor not building pressure', rootCause: 'Faulty inlet valve', actionTaken: 'Replaced inlet valve assembly', downtime: 2.0, priority: 'critical', status: 'closed', reportedBy: 'Murugan K', assignedTo: 'Arun P', sparesUsed: ['Inlet Valve Assembly'], cost: 6800 },
];

export const mockWorkOrders: WorkOrder[] = [
  { id: '1', woNumber: 'WO-2026-1045', title: 'VFD replacement for pump motor', type: 'corrective', machineId: '5', machineName: 'Air Compressor', priority: 'high', status: 'assigned', assignedTo: 'Arun P', supervisor: 'Rajan S', dueDate: '2026-07-28', createdAt: '2026-07-25', description: 'Replace faulty VFD drive for cooling water pump motor', estimatedHours: 4 },
  { id: '2', woNumber: 'WO-2026-1044', title: 'PLC battery replacement - Line 3', type: 'preventive', priority: 'medium', status: 'in-progress', assignedTo: 'Selvam R', supervisor: 'Kumar V', dueDate: '2026-07-27', createdAt: '2026-07-24', description: 'Replace PLC CPU backup batteries - all controllers on Line 3', estimatedHours: 2, actualHours: 1.5 },
  { id: '3', woNumber: 'WO-2026-1043', title: 'Transformer oil sample analysis', type: 'predictive', priority: 'medium', status: 'completed', assignedTo: 'Kannan R', supervisor: 'Prasad M', dueDate: '2026-07-25', createdAt: '2026-07-20', description: 'Collect oil samples from 11kV/433V transformers for DGA analysis', estimatedHours: 3, actualHours: 2.5 },
  { id: '4', woNumber: 'WO-2026-1042', title: 'Earthing resistance testing', type: 'preventive', priority: 'high', status: 'open', assignedTo: 'Kumar V', dueDate: '2026-07-30', createdAt: '2026-07-25', description: 'Annual earth resistance measurement for all earthing points in plant', estimatedHours: 8 },
  { id: '5', woNumber: 'WO-2026-1041', title: 'Flow transmitter calibration', type: 'preventive', priority: 'medium', status: 'completed', assignedTo: 'Prasad M', supervisor: 'Rajan S', dueDate: '2026-07-24', createdAt: '2026-07-18', description: 'Calibrate flow transmitters on cooling tower makeup water line', estimatedHours: 4, actualHours: 3.5 },
];

export const mockAssets: Asset[] = [
  { id: '1', code: 'TRF-001', name: '11kV/433V Transformer 1250kVA', category: 'Transformer', type: 'Power Transformer', location: 'Substation 1', department: 'Electrical', manufacturer: 'ABB', model: 'DTSS-1250', serialNumber: 'ABB-TRF-2018-001', installDate: '2018-04-10', status: 'operational', nextPM: '2026-10-01', criticality: 'critical' },
  { id: '2', code: 'HTP-001', name: '11kV HT Panel A', category: 'HT Panel', type: 'Switchgear', location: 'Substation 1', department: 'Electrical', manufacturer: 'Siemens', model: '8DA10', serialNumber: 'SIE-HTP-2018-001', installDate: '2018-04-10', status: 'operational', nextPM: '2026-09-01', criticality: 'critical' },
  { id: '3', code: 'VFD-012', name: 'VFD - Cooling Tower Fan', category: 'VFD', type: 'Variable Frequency Drive', location: 'Cooling Tower Area', department: 'Electrical', manufacturer: 'Danfoss', model: 'FC302-75kW', serialNumber: 'DAN-VFD-2020-012', installDate: '2020-07-15', status: 'operational', nextPM: '2026-10-15', nextCalibration: '2026-12-01', criticality: 'high' },
  { id: '4', code: 'UPS-001', name: 'UPS - Control Room 20kVA', category: 'UPS', type: 'Online UPS', location: 'Control Room', department: 'Electrical', manufacturer: 'Schneider', model: 'Galaxy 300', serialNumber: 'SCH-UPS-2019-001', installDate: '2019-06-20', status: 'operational', nextPM: '2026-09-20', amcVendor: 'Schneider Electric', amcExpiry: '2026-12-31', criticality: 'critical' },
  { id: '5', code: 'PLC-005', name: 'Siemens S7-1500 PLC - Assembly', category: 'PLC', type: 'Programmable Logic Controller', location: 'Assembly Control Panel', department: 'Instrumentation', manufacturer: 'Siemens', model: 'CPU 1515-2 PN', serialNumber: 'SIE-PLC-2021-005', installDate: '2021-02-10', status: 'operational', nextPM: '2026-08-10', criticality: 'critical' },
  { id: '6', code: 'FLW-023', name: 'Coriolis Flow Meter - Process 1', category: 'Flow Meter', type: 'Coriolis', location: 'Process Line 1', department: 'Instrumentation', manufacturer: 'Endress+Hauser', model: 'Promass 80F', serialNumber: 'EH-FLW-2020-023', installDate: '2020-11-05', status: 'operational', nextPM: '2026-11-05', nextCalibration: '2026-09-01', criticality: 'high' },
  { id: '7', code: 'DG-001', name: 'DG Set 500kVA', category: 'DG', type: 'Diesel Generator', location: 'DG Yard', department: 'Electrical', manufacturer: 'Cummins', model: 'C500D5', serialNumber: 'CUM-DG-2016-001', installDate: '2016-08-15', status: 'operational', nextPM: '2026-08-01', criticality: 'critical' },
  { id: '8', code: 'CAP-001', name: 'Capacitor Bank 500kVAR', category: 'Capacitor Bank', type: 'Automatic Power Factor Correction', location: 'Substation 2', department: 'Electrical', manufacturer: 'Schneider', model: 'VarPlus Box', serialNumber: 'SCH-CAP-2019-001', installDate: '2019-09-10', status: 'operational', nextPM: '2026-10-01', criticality: 'medium' },
];

export const mockSpares: SpareItem[] = [
  { id: '1', code: 'SPR-E-001', name: 'Circuit Breaker 3P 63A', category: 'Electrical', unit: 'Nos', currentStock: 8, minStock: 3, maxStock: 15, location: 'Electrical Store A-1', supplier: 'Havells India', unitPrice: 2800, totalValue: 22400, isCritical: true },
  { id: '2', code: 'SPR-E-002', name: 'Contactor 40A 3Phase', category: 'Electrical', unit: 'Nos', currentStock: 12, minStock: 5, maxStock: 20, location: 'Electrical Store A-2', supplier: 'Siemens', unitPrice: 1850, totalValue: 22200, isCritical: true },
  { id: '3', code: 'SPR-I-001', name: 'Pressure Transmitter 0-10 bar', category: 'Instrumentation', unit: 'Nos', currentStock: 2, minStock: 2, maxStock: 5, location: 'Instrument Store B-1', supplier: 'Endress+Hauser', unitPrice: 18500, totalValue: 37000, isCritical: true, lastReceived: '2026-05-15' },
  { id: '4', code: 'SPR-M-001', name: 'Hydraulic Seal Kit', category: 'Mechanical', unit: 'Set', currentStock: 5, minStock: 2, maxStock: 10, location: 'Mechanical Store C-3', supplier: 'Parker Hannifin', unitPrice: 3500, totalValue: 17500, isCritical: true, lastIssued: '2026-07-25' },
  { id: '5', code: 'SPR-E-003', name: 'VFD 7.5kW', category: 'Electrical', unit: 'Nos', currentStock: 1, minStock: 1, maxStock: 3, location: 'Electrical Store A-3', supplier: 'Danfoss', unitPrice: 28500, totalValue: 28500, isCritical: true },
  { id: '6', code: 'SPR-E-004', name: 'Motor 22kW TEFC', category: 'Electrical', unit: 'Nos', currentStock: 2, minStock: 1, maxStock: 4, location: 'Electrical Store B-1', supplier: 'WEG', unitPrice: 45000, totalValue: 90000, isCritical: true },
  { id: '7', code: 'SPR-I-002', name: 'Temperature Transmitter PT100', category: 'Instrumentation', unit: 'Nos', currentStock: 6, minStock: 3, maxStock: 10, location: 'Instrument Store B-2', supplier: 'Yokogawa', unitPrice: 8500, totalValue: 51000, isCritical: false },
  { id: '8', code: 'SPR-L-001', name: 'LED Flood Light 150W', category: 'Lighting', unit: 'Nos', currentStock: 24, minStock: 10, maxStock: 50, location: 'Electrical Store C-1', supplier: 'Philips', unitPrice: 2200, totalValue: 52800, isCritical: false },
];

export const mockProjects: Project[] = [
  { id: '1', projectNo: 'PRJ-2026-012', name: 'Solar Power Plant 500kWp Installation', type: 'energy-saving', status: 'in-progress', priority: 'high', budget: 3500000, spent: 2100000, progress: 62, startDate: '2026-03-01', endDate: '2026-09-30', projectManager: 'Rajesh Kumar', description: 'Installation of rooftop solar PV plant to reduce grid dependency by 30%' },
  { id: '2', projectNo: 'PRJ-2026-011', name: 'SCADA Upgrade - Plant Wide', type: 'automation', status: 'in-progress', priority: 'high', budget: 1800000, spent: 720000, progress: 40, startDate: '2026-04-15', endDate: '2026-11-30', projectManager: 'Arun P', description: 'Upgrade existing SCADA system to latest platform with improved cybersecurity' },
  { id: '3', projectNo: 'PRJ-2026-010', name: 'Capacitor Bank Addition 300kVAR', type: 'energy-saving', status: 'planning', priority: 'medium', budget: 450000, spent: 15000, progress: 5, startDate: '2026-08-01', endDate: '2026-09-15', projectManager: 'Kumar V', description: 'Addition of capacitor bank to improve power factor and reduce maximum demand charges' },
  { id: '4', projectNo: 'PRJ-2025-008', name: 'Robot Integration - Line 4', type: 'automation', status: 'completed', priority: 'high', budget: 2800000, spent: 2750000, progress: 100, startDate: '2025-10-01', endDate: '2026-03-31', projectManager: 'Selvam R', description: 'Integration of 3 welding robots for automated welding on production line 4' },
  { id: '5', projectNo: 'PRJ-2026-009', name: 'LED Lighting Upgrade - Plant', type: 'energy-saving', status: 'completed', priority: 'medium', budget: 680000, spent: 645000, progress: 100, startDate: '2026-02-01', endDate: '2026-06-30', projectManager: 'Kannan R', description: 'Complete LED lighting replacement across the plant for energy savings' },
];

export const mockEnergyData: EnergyData[] = [
  { date: 'Jan', consumption: 125000, cost: 875000, powerFactor: 0.92, maxDemand: 450 },
  { date: 'Feb', consumption: 118000, cost: 826000, powerFactor: 0.93, maxDemand: 435 },
  { date: 'Mar', consumption: 132000, cost: 924000, powerFactor: 0.91, maxDemand: 468 },
  { date: 'Apr', consumption: 128000, cost: 896000, powerFactor: 0.94, maxDemand: 455 },
  { date: 'May', consumption: 141000, cost: 987000, powerFactor: 0.93, maxDemand: 490 },
  { date: 'Jun', consumption: 138000, cost: 966000, powerFactor: 0.94, maxDemand: 480 },
  { date: 'Jul', consumption: 145000, cost: 1015000, powerFactor: 0.94, maxDemand: 498 },
];

export const monthlyBreakdowns = [
  { month: 'Jan', count: 14, resolved: 13, cost: 185000 },
  { month: 'Feb', count: 11, resolved: 11, cost: 142000 },
  { month: 'Mar', count: 18, resolved: 16, cost: 238000 },
  { month: 'Apr', count: 9,  resolved: 9,  cost: 98000  },
  { month: 'May', count: 15, resolved: 14, cost: 195000 },
  { month: 'Jun', count: 12, resolved: 12, cost: 156000 },
  { month: 'Jul', count: 8,  resolved: 5,  cost: 104000 },
];

export const pmComplianceData = [
  { month: 'Jan', planned: 48, completed: 44, compliance: 91.7 },
  { month: 'Feb', planned: 42, completed: 40, compliance: 95.2 },
  { month: 'Mar', planned: 52, completed: 48, compliance: 92.3 },
  { month: 'Apr', planned: 45, completed: 43, compliance: 95.6 },
  { month: 'May', planned: 50, completed: 47, compliance: 94.0 },
  { month: 'Jun', planned: 48, completed: 46, compliance: 95.8 },
  { month: 'Jul', planned: 40, completed: 38, compliance: 95.0 },
];

export const topBreakdownMachines = [
  { name: 'Hydraulic Press',   breakdowns: 18, downtime: 52.5, cost: 145000 },
  { name: 'CNC Center',        breakdowns: 12, downtime: 28.0, cost: 98000  },
  { name: 'Injection Moulding',breakdowns: 10, downtime: 24.5, cost: 86000  },
  { name: 'Laser Cutter',      breakdowns: 8,  downtime: 22.0, cost: 72000  },
  { name: 'Air Compressor',    breakdowns: 7,  downtime: 15.5, cost: 58000  },
  { name: 'Conveyor A',        breakdowns: 6,  downtime: 18.0, cost: 48000  },
  { name: 'Overhead Crane',    breakdowns: 5,  downtime: 12.0, cost: 38000  },
  { name: 'Welding Robot',     breakdowns: 4,  downtime: 9.5,  cost: 32000  },
];

export const departmentEnergyData = [
  { name: 'Production', value: 42, fill: '#3b82f6' },
  { name: 'Utility',    value: 22, fill: '#22c55e' },
  { name: 'Assembly',   value: 15, fill: '#f59e0b' },
  { name: 'HVAC',       value: 12, fill: '#8b5cf6' },
  { name: 'Lighting',   value: 6,  fill: '#06b6d4' },
  { name: 'Others',     value: 3,  fill: '#64748b' },
];

export const mockNotifications: Notification[] = [
  { id: '1', type: 'breakdown', title: 'Critical Breakdown', message: 'Hydraulic Press MCH-003 breakdown reported - Production stopped', priority: 'critical', createdAt: '2026-07-25T08:30:00', read: false },
  { id: '2', type: 'pm-due', title: 'PM Overdue', message: 'Air Compressor weekly PM is 2 days overdue', priority: 'high', createdAt: '2026-07-25T07:00:00', read: false },
  { id: '3', type: 'calibration', title: 'Calibration Due', message: 'Pressure Transmitter PT-023 calibration due in 3 days', priority: 'medium', createdAt: '2026-07-24T16:00:00', read: false },
  { id: '4', type: 'approval', title: 'Approval Pending', message: 'Work Order WO-2026-1044 requires your approval', priority: 'medium', createdAt: '2026-07-24T14:30:00', read: true },
  { id: '5', type: 'alert', title: 'Power Factor Alert', message: 'Power factor dropped below 0.90 at Substation 2', priority: 'high', createdAt: '2026-07-24T12:00:00', read: true },
  { id: '6', type: 'permit', title: 'Permit Expiring', message: 'LOTO permit PTW-2026-089 expires in 1 hour', priority: 'critical', createdAt: '2026-07-25T09:00:00', read: false },
];

export const shiftInfo = {
  current: 'A Shift',
  start: '06:00',
  end: '14:00',
  supervisor: 'Rajan Selvam',
  technicians: 6,
  totalMen: 12,
};
