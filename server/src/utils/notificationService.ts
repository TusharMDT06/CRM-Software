import { Types } from 'mongoose';
import { Resend } from 'resend';
import { Notification, NotificationType } from '../models/Notification.js';
import {
  NotificationPreference,
  DEFAULT_PREFERENCES,
} from '../models/NotificationPreference.js';
import { User, IUser } from '../models/User.js';

export interface CreateNotificationParams {
  userId: Types.ObjectId | string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  entityType?: string;
  entityId?: string;
  actorId?: Types.ObjectId | string | null;
}

/**
 * Dispatches an in-app and/or email notification according to preferences.
 * Adheres to:
 * - No self-notifications (actorId === userId)
 * - 10-minute deduplication for identical (user, type, entityType, entityId)
 * - User notification preferences (default in-app true, email true only for quote_accepted, invoice_paid, invoice_overdue)
 */
export async function sendNotification(params: CreateNotificationParams): Promise<void> {
  const { userId, type, title, body, link, entityType, entityId, actorId } = params;

  // 1. Guard: Never notify user of their own action
  if (actorId && userId.toString() === actorId.toString()) {
    return;
  }

  // 2. Guard: Deduplicate within 10 minutes (600,000 ms)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const existingRecent = await Notification.findOne({
    user: new Types.ObjectId(userId.toString()),
    type,
    ...(entityType ? { entityType } : {}),
    ...(entityId ? { entityId } : {}),
    createdAt: { $gte: tenMinutesAgo },
  });

  if (existingRecent) {
    // Already notified recently about this entity & type
    return;
  }

  // 3. Fetch user & preferences
  const user = await User.findById(userId);
  if (!user || !user.active) {
    return;
  }

  const prefDoc = await NotificationPreference.findOne({ user: user._id });
  const typePref = prefDoc?.preferences?.[type] || DEFAULT_PREFERENCES[type] || { inApp: true, email: false };

  // 4. In-App Notification
  if (typePref.inApp) {
    await Notification.create({
      user: user._id,
      type,
      title,
      body,
      link: link || '',
      entityType: entityType || '',
      entityId: entityId || '',
      createdAt: new Date(),
    });
  }

  // 5. Email Notification
  if (typePref.email && process.env.RESEND_API_KEY && user.email) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const emailFrom = process.env.EMAIL_FROM || 'Flowdesk CRM <notifications@resend.dev>';
      const siteUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      const actionUrl = link ? `${siteUrl}${link}` : siteUrl;

      await resend.emails.send({
        from: emailFrom,
        to: [user.email],
        subject: `[Flowdesk] ${title}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #18181b;">
            <div style="margin-bottom: 24px;">
              <span style="font-size: 18px; font-weight: 700; color: #09090b; letter-spacing: -0.02em;">Flowdesk</span>
            </div>
            <div style="background: #ffffff; border: 1px solid #e4e4e7; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              <h2 style="margin: 0 0 12px; font-size: 16px; font-weight: 600; color: #09090b;">${title}</h2>
              <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.5; color: #52525b;">${body}</p>
              ${
                link
                  ? `<a href="${actionUrl}" style="display: inline-block; background: #09090b; color: #ffffff; padding: 10px 18px; font-size: 13px; font-weight: 500; text-decoration: none; border-radius: 8px;">View Details</a>`
                  : ''
              }
            </div>
            <p style="margin-top: 24px; font-size: 12px; color: #a1a1aa; text-align: center;">
              You received this notification according to your Flowdesk notification preferences.
            </p>
          </div>
        `,
        text: `${title}\n\n${body}\n\n${link ? `View: ${actionUrl}` : ''}`,
      });
    } catch (emailErr) {
      console.warn('[NotificationService] Email delivery failed:', emailErr);
      // Non-fatal
    }
  }
}

/**
 * Notifies all users with role 'admin' or 'manager' (e.g. for quote approval or workflow errors)
 */
export async function notifyManagersAndAdmins(params: Omit<CreateNotificationParams, 'userId'>): Promise<void> {
  const recipients = await User.find({
    role: { $in: ['admin', 'manager'] },
    active: true,
  });

  for (const recipient of recipients) {
    await sendNotification({
      ...params,
      userId: recipient._id,
    });
  }
}

/**
 * Notifies all admins
 */
export async function notifyAdmins(params: Omit<CreateNotificationParams, 'userId'>): Promise<void> {
  const admins = await User.find({
    role: 'admin',
    active: true,
  });

  for (const admin of admins) {
    await sendNotification({
      ...params,
      userId: admin._id,
    });
  }
}
