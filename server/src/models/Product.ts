import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../utils/tenantPlugin.js';

export type ProductUnit = 'nos' | 'hours' | 'days' | 'months' | 'kg' | 'other';

export interface IProduct extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  name: string;
  sku: string;
  description?: string;
  unitPrice: number; // integer paise
  taxRate: number; // percentage, e.g. 18
  unit: ProductUnit;
  active: boolean;
  owner: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    sku: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
      default: 0, // in paise
    },
    taxRate: {
      type: Number,
      required: true,
      default: 18,
      min: 0,
      max: 100,
    },
    unit: {
      type: String,
      enum: ['nos', 'hours', 'days', 'months', 'kg', 'other'],
      default: 'nos',
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

ProductSchema.index({ tenantId: 1, sku: 1 }, { unique: true });
ProductSchema.index({ name: 'text', description: 'text', sku: 'text' });
ProductSchema.plugin(tenantPlugin);

export const Product = mongoose.model<IProduct>('Product', ProductSchema);
