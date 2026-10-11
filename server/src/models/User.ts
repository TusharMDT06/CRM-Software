import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../utils/tenantPlugin.js';

export type UserRole = 'platform_admin' | 'admin' | 'manager' | 'sales';

export interface IUser extends Document {
  _id: Types.ObjectId;
  tenantId?: Types.ObjectId; // null or undefined for platform_admin only
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
  isVerified: boolean;
  verificationToken?: string;
  verificationExpires?: Date;
  inviteToken?: string;
  inviteExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: false, // platform_admin has no tenant
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true, // globally unique
      trim: true,
      lowercase: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['platform_admin', 'admin', 'manager', 'sales'],
      default: 'sales',
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    isVerified: {
      type: Boolean,
      default: true, // true for seeded/invited users
      index: true,
    },
    verificationToken: {
      type: String,
      index: true,
    },
    verificationExpires: {
      type: Date,
    },
    inviteToken: {
      type: String,
      index: true,
    },
    inviteExpires: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Apply central tenant isolation plugin
UserSchema.plugin(tenantPlugin);

export const User = mongoose.model<IUser>('User', UserSchema);
