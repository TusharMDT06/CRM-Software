import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../utils/tenantPlugin.js';

export interface ICounter extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  prefix: string; // e.g. 'QT', 'INV'
  year: number; // e.g. 2026
  seq: number; // incremented atomically
}

const CounterSchema = new Schema<ICounter>(
  {
    prefix: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    year: {
      type: Number,
      required: true,
    },
    seq: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// One counter per tenant, prefix, and year
CounterSchema.index({ tenantId: 1, prefix: 1, year: 1 }, { unique: true });
CounterSchema.plugin(tenantPlugin);

export const Counter = mongoose.model<ICounter>('Counter', CounterSchema);

/**
 * Generates an atomic, unforgeable, monotonically increasing document number per tenant
 * Format: ${prefix}-${year}-${seq:04d} (e.g. QT-2026-0001, INV-2026-0001)
 */
export async function getNextDocumentNumber(
  prefix: string,
  year: number = new Date().getFullYear()
): Promise<string> {
  const cleanPrefix = prefix.trim().toUpperCase();
  const counter = await Counter.findOneAndUpdate(
    { prefix: cleanPrefix, year },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const seqStr = String(counter.seq).padStart(4, '0');
  return `${cleanPrefix}-${year}-${seqStr}`;
}
