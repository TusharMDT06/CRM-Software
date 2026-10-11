import mongoose, { Document, Schema, Types } from 'mongoose';
import { EntityType } from './Activity.js';
import { tenantPlugin } from '../utils/tenantPlugin.js';

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'url';

export interface IFieldDefinition extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  entity: EntityType;
  key: string;
  label: string;
  type: FieldType;
  options: string[];
  required: boolean;
  order: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FieldDefinitionSchema = new Schema<IFieldDefinition>(
  {
    entity: {
      type: String,
      enum: ['lead', 'contact', 'account', 'deal'],
      required: true,
      index: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['text', 'number', 'date', 'select', 'checkbox', 'url'],
      required: true,
    },
    options: {
      type: [String],
      default: [],
    },
    required: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

FieldDefinitionSchema.index({ tenantId: 1, entity: 1, key: 1 }, { unique: true });
FieldDefinitionSchema.index({ tenantId: 1, entity: 1, order: 1 });
FieldDefinitionSchema.plugin(tenantPlugin);

export const FieldDefinition = mongoose.model<IFieldDefinition>(
  'FieldDefinition',
  FieldDefinitionSchema
);
