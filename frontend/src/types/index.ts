export type UserRole = 'manager' | 'deputy_manager' | 'shift_engineer' | 'guest';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  avatar?: string;
  shift?: string;
  employeeId: string;
  phone?: string;
  dateOfJoining?: string;
}

export interface Machine {
  id: string;
  code: string;
  name: string;
  department: string;
  location: string;
  manufacturer: string;
  serialNumber: string;
  installationDate: string;
  criticality: 'critical' | 'high' | 'medium' | 'low';
  status: 'running' | 'breakdown' | 'maintenance' | 'idle';
  availability: number;
  plcDetails?: string;
  motorDetails?: string;
}

export interface PMSchedule {
  id: string;
  machineId: string;
  machineName: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'half-yearly' | 'yearly';
  nextDueDate: string;
  lastCompleted?: string;
  status: 'pending' | 'completed' | 'overdue' | 'in-progress';
  assignedTo: string;
  checklist: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface Breakdown {
  id: string;
  ticketNo: string;
  machineId: string;
  machineName: string;
  reportedAt: string;
  resolvedAt?: string;
  problem: string;
  rootCause?: string;
  actionTaken?: string;
  downtime: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  reportedBy: string;
  assignedTo?: string;
  sparesUsed?: string[];
  cost?: number;
}

export interface WorkOrder {
  id: string;
  woNumber: string;
  title: string;
  type: 'corrective' | 'preventive' | 'predictive' | 'project';
  machineId?: string;
  machineName?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'assigned' | 'in-progress' | 'completed' | 'closed';
  assignedTo: string;
  supervisor?: string;
  dueDate: string;
  createdAt: string;
  completedAt?: string;
  description: string;
  estimatedHours: number;
  actualHours?: number;
}

export interface Asset {
  id: string;
  code: string;
  name: string;
  category: string;
  type: string;
  location: string;
  department: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  installDate: string;
  status: 'operational' | 'under-maintenance' | 'breakdown' | 'decommissioned';
  nextPM: string;
  nextCalibration?: string;
  amcVendor?: string;
  amcExpiry?: string;
  criticality: 'critical' | 'high' | 'medium' | 'low';
}

export interface SpareItem {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  location: string;
  supplier: string;
  unitPrice: number;
  totalValue: number;
  isCritical: boolean;
  lastReceived?: string;
  lastIssued?: string;
}

export interface Project {
  id: string;
  projectNo: string;
  name: string;
  type: 'electrical' | 'automation' | 'energy-saving' | 'capex' | 'opex';
  status: 'planning' | 'in-progress' | 'on-hold' | 'completed';
  priority: 'high' | 'medium' | 'low';
  budget: number;
  spent: number;
  progress: number;
  startDate: string;
  endDate: string;
  projectManager: string;
  description: string;
}

export interface KPIData {
  oee: number;
  mtbf: number;
  mttr: number;
  pmCompliance: number;
  breakdownPct: number;
  energyCost: number;
  maintenanceCost: number;
  powerFactor: number;
  electricalAvailability: number;
  instrumentationAvailability: number;
  budgetUtilization: number;
  labourEfficiency: number;
}

export interface EnergyData {
  date: string;
  consumption: number;
  cost: number;
  powerFactor: number;
  maxDemand: number;
}

export interface Notification {
  id: string;
  type: 'breakdown' | 'pm-due' | 'calibration' | 'permit' | 'approval' | 'alert';
  title: string;
  message: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  createdAt: string;
  read: boolean;
}
