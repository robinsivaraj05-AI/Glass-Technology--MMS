export interface EmploymentRecord {
  id: string; company: string; industry: string; country: string;
  designation: string; department: string; employmentType: string;
  joiningDate: string; leavingDate: string; experience: string;
  salary: string; responsibilities: string; projects: string;
  reasonLeaving: string; reportingManager: string;
}
export interface EducationRecord {
  id: string; degree: string; course: string; specialization: string;
  institution: string; university: string; country: string;
  grade: string; passingYear: string; duration: string;
}
export interface QualificationRecord {
  id: string; courseName: string; category: string; institute: string;
  certificateNo: string; startDate: string; completionDate: string;
  expiryDate: string; trainerName: string; hours: number;
  result: string; remarks: string;
}
export interface SkillRecord { name: string; rating: number; category: string; }
export interface DocumentRecord {
  id: string; type: string; name: string; uploadDate: string; expiryDate: string; size: string;
  dataUrl?: string;
}
export interface PerformanceRecord {
  id: string; year: number; kpiScore: number; technical: number; discipline: number;
  attendance: number; safety: number; leadership: number; teamwork: number;
  problemSolving: number; innovation: number; promotionRecommended: boolean; comments: string;
}
export interface AttendanceSummary {
  workingDays: number; present: number; absent: number; leave: number;
  lateEntry: number; earlyExit: number; overtime: number;
  monthly: { month: string; present: number; absent: number; leave: number }[];
}
export interface LeaveRecord {
  id: string; type: string; from: string; to: string; days: number;
  status: 'approved' | 'rejected' | 'pending'; reason: string; approvedBy: string;
}
export interface TrainingRecord {
  id: string; name: string; type: string; mode: 'Internal' | 'External';
  trainer: string; date: string; duration: string; result: string; remarks: string;
}
export interface PromotionRecord {
  id: string; effectiveDate: string; prevDesignation: string; newDesignation: string;
  prevGrade: string; newGrade: string; prevSalary: string; newSalary: string;
  incrementPct: number; reason: string; approvedBy: string;
}
export interface ClearanceItem { item: string; completed: boolean; }
export interface ResignationDetails {
  resignationDate: string; noticePeriod: string; lastWorkingDate: string;
  submittedTo: string; approvedBy: string; approvalDate: string;
  exitInterviewDate: string; exitInterviewNotes: string; reason: string;
  employeeRemarks: string; managerComments: string; hrComments: string;
  rootCause: string; lessonsLearned: string; retentionActions: string;
  clearance: ClearanceItem[];
}
export interface FullEmployee {
  id: string; empId: string; name: string; photo: string;
  designation: string; department: string; section: string;
  reportingManager: string; employeeType: string; grade: string;
  nationality: string; dateOfBirth: string; gender: string;
  bloodGroup: string; maritalStatus: string;
  indiaPhone: string; uaePhone: string; companyPhone: string;
  personalEmail: string; companyEmail?: string;
  currentAddress: string; permanentAddress: string;
  emergencyContactPerson: string; emergencyContactNumber: string;
  emiratesId: string; passportNo: string; visaExpiry: string; passportExpiry: string;
  joiningDate: string; yearsOfExperience: number;
  status: 'active' | 'on_leave' | 'suspended' | 'resigned' | 'not_joined';
  employmentHistory: EmploymentRecord[];
  education: EducationRecord[];
  qualifications: QualificationRecord[];
  skills: SkillRecord[];
  documents: DocumentRecord[];
  performance: PerformanceRecord[];
  attendance: AttendanceSummary;
  leaves: LeaveRecord[];
  training: TrainingRecord[];
  promotions: PromotionRecord[];
  resignation?: ResignationDetails;
}

const MONTHLY_ATT = [
  { month:'Jan', present:24, absent:0, leave:2 }, { month:'Feb', present:22, absent:1, leave:1 },
  { month:'Mar', present:25, absent:0, leave:1 }, { month:'Apr', present:23, absent:0, leave:2 },
  { month:'May', present:24, absent:1, leave:1 }, { month:'Jun', present:25, absent:0, leave:0 },
];

export const mockEmployees: FullEmployee[] = [
  {
    id:'emp-001', empId:'EMP-001', name:'Rajesh Kumar', photo:'',
    designation:'Deputy Manager', department:'Electrical & Instrumentation', section:'Electrical',
    reportingManager:'Senthil Babu', employeeType:'Permanent', grade:'M3',
    nationality:'Indian', dateOfBirth:'1985-06-15', gender:'Male',
    bloodGroup:'O+', maritalStatus:'Married',
    indiaPhone:'+91 98765 43210', uaePhone:'+971 50 123 4567', companyPhone:'+971 4 234 5678',
    personalEmail:'rajesh.kumar@gmail.com', companyEmail:'deputy@mms.com',
    currentAddress:'Flat 302, Al Nahda Building, Dubai, UAE',
    permanentAddress:'14 Gandhi Street, T.Nagar, Chennai - 600017',
    emergencyContactPerson:'Priya Kumar (Wife)', emergencyContactNumber:'+91 98765 00001',
    emiratesId:'784-1985-1234567-8', passportNo:'P1234567',
    visaExpiry:'2026-08-15', passportExpiry:'2027-03-10',
    joiningDate:'2020-01-10', yearsOfExperience:15, status:'active',
    employmentHistory:[
      { id:'eh1', company:'Bosch India Ltd', industry:'Automotive', country:'India', designation:'Electrical Engineer', department:'Maintenance', employmentType:'Permanent', joiningDate:'2010-06-01', leavingDate:'2015-08-31', experience:'5 Years 3 Months', salary:'INR 6,00,000 PA', responsibilities:'HT/LT panel maintenance, VFD commissioning, PLC fault diagnosis', projects:'VFD Upgrade Project, Energy Saving Initiative', reasonLeaving:'Better Opportunity', reportingManager:'Mr. Suresh Babu' },
      { id:'eh2', company:'Siemens India', industry:'Manufacturing', country:'India', designation:'Senior Engineer', department:'E&I', employmentType:'Permanent', joiningDate:'2015-09-01', leavingDate:'2019-12-31', experience:'4 Years 4 Months', salary:'INR 12,00,000 PA', responsibilities:'SCADA system maintenance, PLC programming, instrumentation calibration', projects:'SCADA Upgrade, ISO 50001 Implementation', reasonLeaving:'UAE Opportunity', reportingManager:'Mr. Krishnamurthy' },
    ],
    education:[
      { id:'ed1', degree:'B.E', course:'Electrical & Electronics Engineering', specialization:'Power Systems', institution:'Anna University, Chennai', university:'Anna University', country:'India', grade:'72%', passingYear:'2008', duration:'4 Years' },
      { id:'ed2', degree:'Diploma', course:'Industrial Automation', specialization:'PLC & SCADA', institution:'NTTF, Bangalore', university:'NTTF', country:'India', grade:'85%', passingYear:'2010', duration:'1 Year' },
    ],
    qualifications:[
      { id:'q1', courseName:'Siemens TIA Portal V17', category:'PLC', institute:'Siemens Training Center Dubai', certificateNo:'STC-2021-4521', startDate:'2021-03-01', completionDate:'2021-03-05', expiryDate:'2024-03-05', trainerName:'Mr. Ahmed Al Rashidi', hours:40, result:'Pass', remarks:'Advanced level completed' },
      { id:'q2', courseName:'Electrical Safety & Arc Flash', category:'Electrical Safety', institute:'NFPA Certified Center', certificateNo:'NFPA-2022-1234', startDate:'2022-06-10', completionDate:'2022-06-12', expiryDate:'2025-06-12', trainerName:'John Smith', hours:16, result:'Pass', remarks:'NFPA 70E compliant' },
      { id:'q3', courseName:'ISO 45001 Lead Auditor', category:'ISO 45001', institute:'Bureau Veritas', certificateNo:'BV-2023-8901', startDate:'2023-01-15', completionDate:'2023-01-20', expiryDate:'2026-07-01', trainerName:'Ms. Sarah Johnson', hours:40, result:'Pass', remarks:'Certified Lead Auditor' },
    ],
    skills:[
      { name:'Electrical Maintenance', rating:5, category:'Electrical' },
      { name:'PLC Programming', rating:5, category:'Automation' },
      { name:'SCADA', rating:4, category:'Automation' },
      { name:'VFD / Drives', rating:5, category:'Automation' },
      { name:'Instrumentation', rating:4, category:'Instrumentation' },
      { name:'HT Panel Maintenance', rating:4, category:'Electrical' },
      { name:'Transformer Maintenance', rating:4, category:'Electrical' },
      { name:'Calibration', rating:3, category:'Instrumentation' },
      { name:'Troubleshooting', rating:5, category:'General' },
      { name:'AutoCAD Electrical', rating:3, category:'Design' },
    ],
    documents:[
      { id:'d1', type:'Passport', name:'Passport_RajeshKumar.pdf', uploadDate:'2022-04-01', expiryDate:'2027-03-10', size:'2.1 MB' },
      { id:'d2', type:'Emirates ID', name:'EmiratesID_RajeshKumar.pdf', uploadDate:'2022-04-01', expiryDate:'2026-08-15', size:'1.2 MB' },
      { id:'d3', type:'Experience Certificate', name:'Bosch_ExpCert.pdf', uploadDate:'2020-01-10', expiryDate:'', size:'0.8 MB' },
      { id:'d4', type:'Educational Certificate', name:'BE_Certificate.pdf', uploadDate:'2020-01-10', expiryDate:'', size:'1.5 MB' },
    ],
    performance:[
      { id:'p1', year:2024, kpiScore:91, technical:90, discipline:95, attendance:92, safety:98, leadership:88, teamwork:90, problemSolving:92, innovation:85, promotionRecommended:true, comments:'Excellent performance. Strong leadership in PM compliance improvement.' },
      { id:'p2', year:2023, kpiScore:87, technical:88, discipline:92, attendance:90, safety:95, leadership:85, teamwork:88, problemSolving:87, innovation:80, promotionRecommended:false, comments:'Good overall performance. Improved breakdown response time significantly.' },
    ],
    attendance:{ workingDays:150, present:144, absent:1, leave:5, lateEntry:2, earlyExit:1, overtime:32, monthly:MONTHLY_ATT },
    leaves:[
      { id:'l1', type:'Annual Leave', from:'2024-01-15', to:'2024-01-22', days:7, status:'approved', reason:'Family vacation to India', approvedBy:'Senthil Babu' },
      { id:'l2', type:'Sick Leave', from:'2024-03-05', to:'2024-03-06', days:2, status:'approved', reason:'Fever', approvedBy:'Senthil Babu' },
      { id:'l3', type:'Emergency Leave', from:'2024-07-10', to:'2024-07-12', days:3, status:'pending', reason:'Family emergency', approvedBy:'' },
    ],
    training:[
      { id:'t1', name:'LOTO Procedure Training', type:'Safety', mode:'Internal', trainer:'Safety Officer', date:'2024-01-10', duration:'4 hours', result:'Pass', remarks:'Annual refresher' },
      { id:'t2', name:'Siemens PLC Advanced', type:'Technical', mode:'External', trainer:'Siemens Trainer', date:'2023-06-15', duration:'3 days', result:'Pass', remarks:'TIA Portal V18 features' },
    ],
    promotions:[
      { id:'pr1', effectiveDate:'2022-04-01', prevDesignation:'Senior Engineer', newDesignation:'Deputy Manager', prevGrade:'E4', newGrade:'M3', prevSalary:'AED 12,000', newSalary:'AED 16,500', incrementPct:37.5, reason:'Exceptional performance and team leadership capability', approvedBy:'Senthil Babu' },
    ],
  },
  {
    id:'emp-002', empId:'EMP-002', name:'Arun Selvam', photo:'',
    designation:'Senior Engineer', department:'Electrical & Instrumentation', section:'Automation',
    reportingManager:'Rajesh Kumar', employeeType:'Permanent', grade:'E4',
    nationality:'Indian', dateOfBirth:'1990-03-22', gender:'Male',
    bloodGroup:'A+', maritalStatus:'Married',
    indiaPhone:'+91 98765 43211', uaePhone:'+971 50 234 5678', companyPhone:'+971 4 234 5679',
    personalEmail:'arun.selvam@gmail.com', companyEmail:'engineer@mms.com',
    currentAddress:'Room 12, Al Qusais Labour Camp, Dubai, UAE',
    permanentAddress:'22 Nehru Street, Coimbatore - 641001',
    emergencyContactPerson:'Kavitha Selvam (Wife)', emergencyContactNumber:'+91 87654 00001',
    emiratesId:'784-1990-2345678-1', passportNo:'P2345678',
    visaExpiry:'2025-09-20', passportExpiry:'2028-07-15',
    joiningDate:'2016-04-10', yearsOfExperience:8, status:'active',
    employmentHistory:[
      { id:'eh1', company:'Larsen & Toubro', industry:'Engineering & Construction', country:'India', designation:'Engineer', department:'Electrical', employmentType:'Permanent', joiningDate:'2012-07-01', leavingDate:'2016-03-31', experience:'3 Years 9 Months', salary:'INR 4,80,000 PA', responsibilities:'Electrical installations, panel wiring, commissioning', projects:'Industrial Plant Electrification', reasonLeaving:'Better Opportunity Abroad', reportingManager:'Mr. Balasubramaniam' },
    ],
    education:[
      { id:'ed1', degree:'B.Tech', course:'Electrical Engineering', specialization:'Power Electronics', institution:'PSG College of Technology', university:'Anna University', country:'India', grade:'78%', passingYear:'2012', duration:'4 Years' },
    ],
    qualifications:[
      { id:'q1', courseName:'ABB Robot Programming', category:'Robotics', institute:'ABB Training Center', certificateNo:'ABB-2022-0091', startDate:'2022-09-01', completionDate:'2022-09-05', expiryDate:'2027-09-05', trainerName:'ABB Specialist', hours:40, result:'Pass', remarks:'IRC5 Controller' },
      { id:'q2', courseName:'LOTO Certified Worker', category:'Lockout Tagout (LOTO)', institute:'Internal Safety Dept', certificateNo:'LOTO-2024-012', startDate:'2024-01-08', completionDate:'2024-01-08', expiryDate:'2025-01-08', trainerName:'Safety Officer', hours:8, result:'Pass', remarks:'Annual cert' },
    ],
    skills:[
      { name:'PLC Programming', rating:5, category:'Automation' },
      { name:'SCADA', rating:4, category:'Automation' },
      { name:'VFD / Drives', rating:5, category:'Automation' },
      { name:'Robot Programming', rating:4, category:'Robotics' },
      { name:'Electrical Maintenance', rating:4, category:'Electrical' },
      { name:'Troubleshooting', rating:5, category:'General' },
    ],
    documents:[
      { id:'d1', type:'Passport', name:'Passport_ArunSelvam.pdf', uploadDate:'2022-01-15', expiryDate:'2028-07-15', size:'1.9 MB' },
      { id:'d2', type:'Visa', name:'Visa_ArunSelvam.pdf', uploadDate:'2022-01-15', expiryDate:'2025-09-20', size:'0.9 MB' },
    ],
    performance:[
      { id:'p1', year:2024, kpiScore:89, technical:92, discipline:88, attendance:90, safety:94, leadership:80, teamwork:90, problemSolving:93, innovation:88, promotionRecommended:true, comments:'Outstanding technical skills. Excellent breakdown resolution time.' },
    ],
    attendance:{ workingDays:150, present:145, absent:0, leave:5, lateEntry:1, earlyExit:0, overtime:45, monthly:MONTHLY_ATT },
    leaves:[
      { id:'l1', type:'Annual Leave', from:'2024-04-01', to:'2024-04-15', days:15, status:'approved', reason:'Annual vacation', approvedBy:'Rajesh Kumar' },
    ],
    training:[
      { id:'t1', name:'Siemens WinCC SCADA', type:'Technical', mode:'External', trainer:'Siemens', date:'2023-11-20', duration:'2 days', result:'Pass', remarks:'WinCC V7.5' },
    ],
    promotions:[
      { id:'pr1', effectiveDate:'2021-01-01', prevDesignation:'Engineer', newDesignation:'Senior Engineer', prevGrade:'E3', newGrade:'E4', prevSalary:'AED 7,500', newSalary:'AED 9,500', incrementPct:26.7, reason:'Performance promotion', approvedBy:'Rajesh Kumar' },
    ],
  },
  {
    id:'emp-003', empId:'EMP-003', name:'Robin Sivaraj', photo:'',
    designation:'IT Engineer', department:'IT', section:'IT Infrastructure',
    reportingManager:'Senthil Babu', employeeType:'Permanent', grade:'E3',
    nationality:'Indian', dateOfBirth:'1995-09-10', gender:'Male',
    bloodGroup:'B+', maritalStatus:'Single',
    indiaPhone:'+91 90000 11111', uaePhone:'+971 50 999 8888', companyPhone:'+971 4 234 5690',
    personalEmail:'robin.sivaraj@gmail.com', companyEmail:'robin@mms.com',
    currentAddress:'Flat 104, Discovery Gardens, Dubai, UAE',
    permanentAddress:'5 Raja Street, Madurai - 625001',
    emergencyContactPerson:'Sivaraj (Father)', emergencyContactNumber:'+91 90000 22222',
    emiratesId:'784-1995-3456789-5', passportNo:'P3456789',
    visaExpiry:'2026-05-30', passportExpiry:'2029-09-10',
    joiningDate:'2021-05-01', yearsOfExperience:5, status:'active',
    employmentHistory:[
      { id:'eh1', company:'TCS', industry:'IT Services', country:'India', designation:'Systems Engineer', department:'IT Infrastructure', employmentType:'Permanent', joiningDate:'2018-08-01', leavingDate:'2021-04-30', experience:'2 Years 9 Months', salary:'INR 3,60,000 PA', responsibilities:'Network administration, server management, helpdesk support', projects:'Network Upgrade, DC Migration', reasonLeaving:'UAE Opportunity', reportingManager:'Mr. Venkat' },
    ],
    education:[
      { id:'ed1', degree:'B.E', course:'Computer Science Engineering', specialization:'Networking', institution:'Madurai Kamaraj University', university:'MKU', country:'India', grade:'74%', passingYear:'2018', duration:'4 Years' },
    ],
    qualifications:[
      { id:'q1', courseName:'CCNA - Cisco Certified', category:'Networking / IT', institute:'Cisco Authorized Center', certificateNo:'CCNA-2022-54321', startDate:'2022-03-01', completionDate:'2022-03-10', expiryDate:'2025-03-10', trainerName:'Cisco Instructor', hours:80, result:'Pass', remarks:'Score: 862/1000' },
      { id:'q2', courseName:'CompTIA Security+', category:'Networking / IT', institute:'CompTIA Center', certificateNo:'SEC-2023-98765', startDate:'2023-07-01', completionDate:'2023-07-05', expiryDate:'2026-07-05', trainerName:'Security Trainer', hours:32, result:'Pass', remarks:'Cybersecurity certified' },
    ],
    skills:[
      { name:'Network Administration', rating:4, category:'IT' },
      { name:'Server Management', rating:4, category:'IT' },
      { name:'Cybersecurity', rating:3, category:'IT' },
      { name:'CCTV & Surveillance', rating:5, category:'IT' },
      { name:'MMS Administration', rating:4, category:'IT' },
      { name:'Troubleshooting', rating:5, category:'General' },
    ],
    documents:[
      { id:'d1', type:'Passport', name:'Passport_Robin.pdf', uploadDate:'2021-05-01', expiryDate:'2029-09-10', size:'1.8 MB' },
      { id:'d2', type:'Training Certificate', name:'CCNA_Certificate.pdf', uploadDate:'2022-03-12', expiryDate:'2025-03-10', size:'0.5 MB' },
    ],
    performance:[
      { id:'p1', year:2024, kpiScore:85, technical:88, discipline:90, attendance:95, safety:92, leadership:78, teamwork:88, problemSolving:87, innovation:90, promotionRecommended:false, comments:'Good IT support. MMS system uptime maintained at 99.5%.' },
    ],
    attendance:{ workingDays:150, present:148, absent:0, leave:2, lateEntry:0, earlyExit:0, overtime:20, monthly:MONTHLY_ATT },
    leaves:[
      { id:'l1', type:'Annual Leave', from:'2024-06-01', to:'2024-06-10', days:10, status:'approved', reason:'India visit', approvedBy:'Senthil Babu' },
    ],
    training:[
      { id:'t1', name:'Cybersecurity Awareness', type:'Technical', mode:'External', trainer:'CompTIA', date:'2023-07-01', duration:'4 days', result:'Pass', remarks:'Security+ certified' },
    ],
    promotions:[],
  },
  {
    id:'emp-004', empId:'EMP-004', name:'Selvam Rajan', photo:'',
    designation:'Electrical Technician', department:'Electrical & Instrumentation', section:'Electrical',
    reportingManager:'Rajesh Kumar', employeeType:'Permanent', grade:'T3',
    nationality:'Indian', dateOfBirth:'1988-12-05', gender:'Male',
    bloodGroup:'AB+', maritalStatus:'Married',
    indiaPhone:'+91 65432 10987', uaePhone:'+971 56 456 7890', companyPhone:'+971 4 234 5681',
    personalEmail:'selvam.rajan@gmail.com', companyEmail:'selvam@mms.com',
    currentAddress:'Room 8, Muhaisnah Labour Camp, Dubai, UAE',
    permanentAddress:'7 Periyar Street, Salem - 636001',
    emergencyContactPerson:'Meena Selvam (Wife)', emergencyContactNumber:'+91 65432 00001',
    emiratesId:'784-1988-4567890-2', passportNo:'P4567890',
    visaExpiry:'2024-12-31', passportExpiry:'2026-05-20',
    joiningDate:'2015-09-05', yearsOfExperience:9, status:'resigned',
    employmentHistory:[
      { id:'eh1', company:'TVS Motors', industry:'Automotive', country:'India', designation:'Electrician', department:'Production', employmentType:'Permanent', joiningDate:'2011-01-01', leavingDate:'2015-08-31', experience:'4 Years 8 Months', salary:'INR 2,40,000 PA', responsibilities:'Machine wiring, fault diagnosis, preventive maintenance', projects:'Line Upgrade', reasonLeaving:'Overseas Opportunity', reportingManager:'Mr. Palani' },
    ],
    education:[
      { id:'ed1', degree:'ITI', course:'Electrician', specialization:'Industrial Wiring', institution:'Government ITI, Salem', university:'NCVT', country:'India', grade:'82%', passingYear:'2008', duration:'2 Years' },
    ],
    qualifications:[
      { id:'q1', courseName:'VFD Operation & Maintenance', category:'VFD', institute:'ABB Training Center', certificateNo:'ABB-VFD-2020-0045', startDate:'2020-02-01', completionDate:'2020-02-03', expiryDate:'2023-02-03', trainerName:'ABB Specialist', hours:24, result:'Pass', remarks:'Expired - renewal needed' },
    ],
    skills:[
      { name:'Motor Rewinding', rating:5, category:'Electrical' },
      { name:'VFD / Drives', rating:4, category:'Automation' },
      { name:'Electrical Maintenance', rating:4, category:'Electrical' },
      { name:'Troubleshooting', rating:4, category:'General' },
    ],
    documents:[
      { id:'d1', type:'Passport', name:'Passport_Selvam.pdf', uploadDate:'2020-06-01', expiryDate:'2026-05-20', size:'1.7 MB' },
    ],
    performance:[
      { id:'p1', year:2023, kpiScore:75, technical:78, discipline:72, attendance:80, safety:85, leadership:65, teamwork:75, problemSolving:76, innovation:60, promotionRecommended:false, comments:'Average performance. Attendance issues noted in Q2.' },
    ],
    attendance:{ workingDays:150, present:130, absent:8, leave:12, lateEntry:10, earlyExit:5, overtime:8, monthly:MONTHLY_ATT },
    leaves:[
      { id:'l1', type:'Annual Leave', from:'2023-07-01', to:'2023-07-30', days:30, status:'approved', reason:'Annual leave India', approvedBy:'Rajesh Kumar' },
      { id:'l2', type:'Sick Leave', from:'2023-04-10', to:'2023-04-14', days:5, status:'approved', reason:'Back pain', approvedBy:'Rajesh Kumar' },
    ],
    training:[
      { id:'t1', name:'Electrical Safety Refresher', type:'Safety', mode:'Internal', trainer:'Safety Officer', date:'2023-02-01', duration:'1 day', result:'Pass', remarks:'Annual safety refresher' },
    ],
    promotions:[],
    resignation: {
      resignationDate:'2024-10-01', noticePeriod:'30 Days', lastWorkingDate:'2024-10-31',
      submittedTo:'Rajesh Kumar', approvedBy:'Senthil Babu', approvalDate:'2024-10-03',
      exitInterviewDate:'2024-10-28', exitInterviewNotes:'Employee cited family reasons and desire to return to India permanently.',
      reason:'Family Relocation',
      employeeRemarks:'I have enjoyed my time at the company. Due to family obligations in India, I need to return permanently. I have no grievances with the management.',
      managerComments:'Selvam was a reliable technician. His leaving is a loss to the team. Notice period served professionally.',
      hrComments:'Resignation accepted as per company policy. All clearances to be completed by last working day.',
      rootCause:'Personal/Family reasons - return to home country permanently.',
      lessonsLearned:'Better retention support for employees with family abroad. Periodic welfare checks recommended.',
      retentionActions:'Offered accommodation upgrade and salary revision, but employee declined due to family commitment.',
      clearance:[
        { item:'Company ID Card Returned', completed:true },
        { item:'Laptop Returned', completed:false },
        { item:'Mobile Phone Returned', completed:true },
        { item:'Uniform Returned', completed:true },
        { item:'PPE Returned', completed:true },
        { item:'Office Keys Returned', completed:true },
        { item:'Documents Submitted', completed:true },
        { item:'Handover Completed', completed:false },
        { item:'Knowledge Transfer Completed', completed:false },
        { item:'Finance Clearance', completed:true },
        { item:'IT Clearance', completed:false },
        { item:'HR Clearance', completed:true },
        { item:'Administration Clearance', completed:true },
      ],
    },
  },
];
