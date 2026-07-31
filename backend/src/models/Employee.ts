import mongoose, { Schema, Document } from 'mongoose';

export interface IEmployee extends Document {
  id: string;
  empId: string;
  name: string;
  photo: string;
  designation: string;
  department: string;
  section: string;
  reportingManager: string;
  employeeType: string;
  grade: string;
  nationality: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup: string;
  maritalStatus: string;
  indiaPhone: string;
  uaePhone: string;
  companyPhone: string;
  personalEmail: string;
  companyEmail: string;
  currentAddress: string;
  permanentAddress: string;
  emergencyContactPerson: string;
  emergencyContactNumber: string;
  emiratesId: string;
  passportNo: string;
  visaExpiry: string;
  passportExpiry: string;
  joiningDate: string;
  yearsOfExperience: number;
  status: 'active' | 'on_leave' | 'suspended' | 'resigned';
  employmentHistory: any[];
  education: any[];
  qualifications: any[];
  skills: any[];
  documents: any[];
  performance: any[];
  attendance: any;
  leaves: any[];
  training: any[];
  promotions: any[];
  resignation?: any;
}

const EmployeeSchema = new Schema<IEmployee>({
  id:                    { type: String, required: true, unique: true },
  empId:                 { type: String, required: true, unique: true },
  name:                  { type: String, required: true },
  photo:                 { type: String, default: '' },
  designation:           { type: String, default: '' },
  department:            { type: String, default: '' },
  section:               { type: String, default: '' },
  reportingManager:      { type: String, default: '' },
  employeeType:          { type: String, default: 'Permanent' },
  grade:                 { type: String, default: '' },
  nationality:           { type: String, default: '' },
  dateOfBirth:           { type: String, default: '' },
  gender:                { type: String, default: '' },
  bloodGroup:            { type: String, default: '' },
  maritalStatus:         { type: String, default: '' },
  indiaPhone:            { type: String, default: '' },
  uaePhone:              { type: String, default: '' },
  companyPhone:          { type: String, default: '' },
  personalEmail:         { type: String, default: '' },
  companyEmail:          { type: String, default: '' },
  currentAddress:        { type: String, default: '' },
  permanentAddress:      { type: String, default: '' },
  emergencyContactPerson:{ type: String, default: '' },
  emergencyContactNumber:{ type: String, default: '' },
  emiratesId:            { type: String, default: '' },
  passportNo:            { type: String, default: '' },
  visaExpiry:            { type: String, default: '' },
  passportExpiry:        { type: String, default: '' },
  joiningDate:           { type: String, default: '' },
  yearsOfExperience:     { type: Number, default: 0 },
  status:                { type: String, enum: ['active', 'on_leave', 'suspended', 'resigned'], default: 'active' },
  employmentHistory:     { type: [Schema.Types.Mixed], default: [] },
  education:             { type: [Schema.Types.Mixed], default: [] },
  qualifications:        { type: [Schema.Types.Mixed], default: [] },
  skills:                { type: [Schema.Types.Mixed], default: [] },
  documents:             { type: [Schema.Types.Mixed], default: [] },
  performance:           { type: [Schema.Types.Mixed], default: [] },
  attendance:            { type: Schema.Types.Mixed, default: { workingDays: 0, present: 0, absent: 0, leave: 0, lateEntry: 0, earlyExit: 0, overtime: 0, monthly: [] } },
  leaves:                { type: [Schema.Types.Mixed], default: [] },
  training:              { type: [Schema.Types.Mixed], default: [] },
  promotions:            { type: [Schema.Types.Mixed], default: [] },
  resignation:           { type: Schema.Types.Mixed, default: null },
}, { timestamps: true });

export default mongoose.model<IEmployee>('Employee', EmployeeSchema);
