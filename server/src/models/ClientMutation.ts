import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IClientMutation extends Document {
  _id: Types.ObjectId;
  clientMutationId: string;
  tenantId?: Types.ObjectId;
  userId?: Types.ObjectId;
  path: string;
  method: string;
  responseStatus: number;
  responseBody: any;
  createdAt: Date;
}

const ClientMutationSchema = new Schema<IClientMutation>(
  {
    clientMutationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: false,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    path: {
      type: String,
      required: true,
    },
    method: {
      type: String,
      required: true,
    },
    responseStatus: {
      type: Number,
      required: true,
    },
    responseBody: {
      type: Schema.Types.Mixed,
      required: true,
    },
    createdAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  {
    timestamps: false,
  }
);

// 24 hour TTL index
ClientMutationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export const ClientMutation = mongoose.model<IClientMutation>(
  'ClientMutation',
  ClientMutationSchema
);
