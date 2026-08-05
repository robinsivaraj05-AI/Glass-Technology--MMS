import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { EmployeeProvider } from './context/EmployeeContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PreventiveMaintenance from './pages/PreventiveMaintenance';
import BreakdownMaintenance from './pages/BreakdownMaintenance';
import AssetManagement from './pages/AssetManagement';
import SpareParts from './pages/SpareParts';
import WorkOrders from './pages/WorkOrders';
import Projects from './pages/Projects';
import EnergyManagement from './pages/EnergyManagement';
import Calibration from './pages/Calibration';
import Safety from './pages/Safety';
import Manpower from './pages/Manpower';
import Employees from './pages/Employees';
import EmployeeProfile from './pages/EmployeeProfile';
import OrgChart from './pages/OrgChart';
import OrgChartSummary from './pages/OrgChartSummary';
import Attendance from './pages/Attendance';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Placeholder from './pages/Placeholder';
import ContractorDashboard from './pages/ContractorDashboard';
import ContractMaster from './pages/ContractMaster';
import OutsourceEntry from './pages/OutsourceEntry';
import OutsourceReport from './pages/OutsourceReport';
import EquipmentMaster from './pages/EquipmentMaster';
import Training from './pages/Training';
import EquipmentEntry from './pages/EquipmentEntry';
import AccessoriesEntry from './pages/AccessoriesEntry';
import RentalReport from './pages/RentalReport';
import FinanceDashboard from './pages/FinanceDashboard';
import MachineMaster from './pages/MachineMaster';
import PurchaseRFQ from './pages/PurchaseRFQ';
import PurchasePO from './pages/PurchasePO';
import PurchaseFollowup from './pages/PurchaseFollowup';
import PurchaseCosting from './pages/PurchaseCosting';
import FinanceEIPurReport from './pages/FinanceEIPurReport';

export default function App() {
  return (
    <AuthProvider>
      <EmployeeProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#0d0d1a', border: '1px solid rgba(59,130,246,0.3)', color: '#f1f5f9', fontSize: 13 },
            success: { iconTheme: { primary: '#22c55e', secondary: '#0d0d1a' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#0d0d1a' } },
          }}
        />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            {/* Maintenance */}
            <Route path="/pm" element={<PreventiveMaintenance />} />
            <Route path="/breakdowns" element={<BreakdownMaintenance />} />
            <Route path="/work-orders" element={<WorkOrders />} />
            <Route path="/predictive" element={<Placeholder title="Predictive Maintenance" description="Vibration monitoring, thermography, motor current analysis, bearing health, insulation resistance testing, and AI-powered failure prediction." />} />
            {/* Assets */}
            <Route path="/assets" element={<AssetManagement />} />
            <Route path="/machines" element={<MachineMaster />} />
            <Route path="/calibration" element={<Calibration />} />
            {/* Spare Parts */}
            <Route path="/spare-parts" element={<SpareParts />} />
            {/* Energy */}
            <Route path="/energy" element={<EnergyManagement />} />
            <Route path="/utility" element={<Placeholder title="Utility Monitoring" description="Real-time monitoring of electricity, diesel, water, compressed air, cooling water, chilled water, boiler, and steam consumption." />} />
            {/* Projects */}
            <Route path="/projects" element={<Projects />} />
            {/* Safety */}
            <Route path="/safety" element={<Safety />} />
            <Route path="/shutdown" element={<Placeholder title="Shutdown Planning" description="Plan and manage plant shutdowns with activity scheduling, resource planning, material requirements, safety permits, and progress tracking." />} />
            {/* Employees */}
            <Route path="/employees" element={<Employees />} />
            <Route path="/employees/:id" element={<EmployeeProfile />} />
            <Route path="/org-chart" element={<OrgChart />} />
            <Route path="/org-chart/summary" element={<OrgChartSummary />} />
            <Route path="/attendance" element={<Attendance />} />
            {/* Manpower */}
            <Route path="/manpower" element={<Manpower />} />
            <Route path="/training" element={<Training />} />
            {/* Finance */}
            <Route path="/budget" element={<Placeholder title="Budget Management" description="Annual and monthly budget planning, maintenance cost tracking, utility costs, variance analysis, and budget approvals." />} />
            <Route path="/vendors" element={<Placeholder title="Vendor Management" description="Vendor details, AMC contracts, service history, performance ratings, and invoice management." />} />
            {/* ISO & Quality */}
            <Route path="/iso" element={<Placeholder title="ISO Documentation" description="ISO 9001, ISO 14001, ISO 45001 document control, revision history, audit findings, CAPA management." />} />
            <Route path="/quality" element={<Placeholder title="Quality Module" description="Defect analysis, customer complaints, corrective actions, preventive actions, and quality reports." />} />
            {/* Other */}
            <Route path="/logbook" element={<Placeholder title="Daily Logbook" description="Shift log with events, power failures, breakdowns, PM completions, safety observations, production losses, and digital signatures." />} />
            {/* Outsource / Contractor */}
            <Route path="/contractor" element={<ContractorDashboard />} />
            <Route path="/contractor/contracts" element={<ContractMaster />} />
            <Route path="/contractor/entry" element={<OutsourceEntry />} />
            <Route path="/contractor/report" element={<OutsourceReport />} />
            {/* Rental Equipment */}
            <Route path="/rental/equipment" element={<EquipmentMaster />} />
            <Route path="/rental/entry" element={<EquipmentEntry />} />
            <Route path="/rental/accessories" element={<AccessoriesEntry />} />
            <Route path="/rental/report" element={<RentalReport />} />
            {/* Purchase */}
            <Route path="/purchase/rfq"      element={<PurchaseRFQ />} />
            <Route path="/purchase/po"       element={<PurchasePO />} />
            <Route path="/purchase/followup" element={<PurchaseFollowup />} />
            <Route path="/purchase/costing"  element={<PurchaseCosting />} />
            {/* Finance */}
            <Route path="/finance/costing"        element={<FinanceDashboard />} />
            <Route path="/finance/ei-pur-report"  element={<FinanceEIPurReport />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/notifications" element={<Placeholder title="Notifications Center" description="All system notifications, email alerts, escalation matrix, and notification history." />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      </EmployeeProvider>
    </AuthProvider>
  );
}
