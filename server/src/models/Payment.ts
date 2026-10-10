import mongoose, { Document, Schema, Types } from 'mongoose';

export type PaymentMethod =
  | 'bank_transfer'
  | 'upi'
  | 'card'
  | 'cash'
  | 'cheque'
  | 'other';

export interface IPayment extends Document {
  _id: Types.ObjectId;
  invoice: Types.ObjectId;
  amount: number; // integer paise > 0
  method: PaymentMethod;
  reference?: string;
  paidAt: Date;
  notes?: string;
  recordedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    invoice: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1, // in paise
    },
    method: {
      type: String,
      enum: ['bank_transfer', 'upi', 'card', 'cash', 'cheque', 'other'],
      default: 'bank_transfer',
      required: true,
    },
    reference: {
      type: String,
      default: '',
      trim: true,
    },
    paidAt: {
      type: Date,
      required: true,
      default: () => new Date(),
      index: true,
    },
    notes: {
      type: String,
      default: '',
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);
