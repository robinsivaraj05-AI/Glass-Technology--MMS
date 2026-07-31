import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: 'manager' | 'deputy_manager' | 'shift_engineer' | 'guest';
  department: string;
  employeeId: string;
  shift?: string;
  phone?: string;
  avatar?: string;
  isActive: boolean;
  comparePassword(candidate: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  role: { type: String, enum: ['manager', 'deputy_manager', 'shift_engineer', 'guest'], default: 'guest' },
  department: { type: String, default: 'Electrical & Instrumentation' },
  employeeId: { type: String, required: true, unique: true },
  shift: String,
  phone: String,
  avatar: String,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = async function (candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model<IUser>('User', UserSchema);
