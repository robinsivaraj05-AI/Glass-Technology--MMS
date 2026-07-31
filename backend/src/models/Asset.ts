import mongoose, { Schema, Document } from 'mongoose';

export interface IAsset extends Document {
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

const AssetSchema = new Schema<IAsset>({
  code:            { type: String, required: true, unique: true, trim: true },
  name:            { type: String, required: true, trim: true },
  category:        { type: String, required: true },
  type:            { type: String, default: '' },
  location:        { type: String, required: true },
  department:      { type: String, required: true },
  manufacturer:    { type: String, required: true },
  model:           { type: String, default: '' },
  serialNumber:    { type: String, default: '' },
  installDate:     { type: String, required: true },
  status:          { type: String, enum: ['operational', 'under-maintenance', 'breakdown', 'decommissioned'], default: 'operational' },
  nextPM:          { type: String, required: true },
  nextCalibration: { type: String, default: '' },
  amcVendor:       { type: String, default: '' },
  amcExpiry:       { type: String, default: '' },
  criticality:     { type: String, enum: ['critical', 'high', 'medium', 'low'], default: 'medium' },
}, { timestamps: true });

AssetSchema.index({ code: 1 });
AssetSchema.index({ status: 1 });
AssetSchema.index({ category: 1 });

export default mongoose.model<IAsset>('Asset', AssetSchema);
