import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../utils/tenantPlugin.js';

export type DocumentStatus = 'draft' | 'under_review' | 'approved' | 'signed' | 'archived';
export type RelatedEntityType = 'deal' | 'account' | 'lead' | 'contact' | 'none';

export interface IDocumentRecord extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  name: string;
  folder: string;
  fileType: string; // 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'png' | 'jpg' | 'zip' | 'txt' | 'other'
  fileSize: number; // size in bytes
  fileData?: string; // base64 data URL or remote storage link
  version: string; // e.g. '1.0'
  status: DocumentStatus;
  tags: string[];
  description?: string;
  relatedTo: {
    entityType: RelatedEntityType;
    entityId?: Types.ObjectId;
    entityName?: string;
  };
  uploadedBy: Types.ObjectId;
  downloadCount: number;
  isShared: boolean;
  isStarred: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new Schema<IDocumentRecord>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    folder: {
      type: String,
      required: true,
      default: 'General',
      trim: true,
      index: true,
    },
    fileType: {
      type: String,
      required: true,
      default: 'pdf',
      lowercase: true,
      trim: true,
    },
    fileSize: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    fileData: {
      type: String,
      default: '',
    },
    version: {
      type: String,
      default: '1.0',
      trim: true,
    },
    status: {
      type: String,
      enum: ['draft', 'under_review', 'approved', 'signed', 'archived'],
      default: 'draft',
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    relatedTo: {
      entityType: {
        type: String,
        enum: ['deal', 'account', 'lead', 'contact', 'none'],
        default: 'none',
        index: true,
      },
      entityId: {
        type: Schema.Types.ObjectId,
        required: false,
        index: true,
      },
      entityName: {
        type: String,
        default: '',
      },
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    downloadCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isShared: {
      type: Boolean,
      default: false,
    },
    isStarred: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

DocumentSchema.index({ tenantId: 1, folder: 1 });
DocumentSchema.index({ tenantId: 1, isStarred: 1 });
DocumentSchema.index({ name: 'text', description: 'text', tags: 'text' });
DocumentSchema.plugin(tenantPlugin);

export const DocumentModel = mongoose.model<IDocumentRecord>('Document', DocumentSchema);
