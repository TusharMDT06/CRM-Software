import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../utils/tenantPlugin.js';

export type MeetingStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type MeetingLocationType = 'google_meet' | 'zoom' | 'teams' | 'in_person' | 'phone' | 'other';
export type RelatedEntityType = 'deal' | 'account' | 'lead' | 'contact' | 'none';

export interface IMeeting extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  title: string;
  from: Date;
  to: Date;
  allDay: boolean;
  status: MeetingStatus;
  locationType: MeetingLocationType;
  locationDetails?: string;
  meetingUrl?: string;
  relatedTo: {
    entityType: RelatedEntityType;
    entityId?: Types.ObjectId;
    entityName?: string;
  };
  contactName?: string;
  contactEmail?: string;
  host: Types.ObjectId;
  participants: string[];
  agenda?: string;
  outcome?: string; // Minutes of Meeting (MOM) / Notes
  reminderMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

const MeetingSchema = new Schema<IMeeting>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    from: {
      type: Date,
      required: true,
      index: true,
    },
    to: {
      type: Date,
      required: true,
      index: true,
    },
    allDay: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    locationType: {
      type: String,
      enum: ['google_meet', 'zoom', 'teams', 'in_person', 'phone', 'other'],
      default: 'google_meet',
    },
    locationDetails: {
      type: String,
      default: '',
      trim: true,
    },
    meetingUrl: {
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
    contactName: {
      type: String,
      default: '',
      trim: true,
    },
    contactEmail: {
      type: String,
      default: '',
      trim: true,
    },
    host: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    participants: {
      type: [String],
      default: [],
    },
    agenda: {
      type: String,
      default: '',
      trim: true,
    },
    outcome: {
      type: String,
      default: '',
      trim: true,
    },
    reminderMinutes: {
      type: Number,
      default: 15,
    },
  },
  {
    timestamps: true,
  }
);

MeetingSchema.index({ tenantId: 1, from: 1, to: 1 });
MeetingSchema.index({ tenantId: 1, host: 1, from: 1 });
MeetingSchema.index({ title: 'text', agenda: 'text', contactName: 'text' });
MeetingSchema.plugin(tenantPlugin);

export const Meeting = mongoose.model<IMeeting>('Meeting', MeetingSchema);
