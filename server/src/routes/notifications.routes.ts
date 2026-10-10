import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { Notification } from '../models/Notification.js';
import {
  NotificationPreference,
  DEFAULT_PREFERENCES,
} from '../models/NotificationPreference.js';
import { authenticate } from '../middleware/auth.js';
import { AuthRequest } from '../types/index.js';

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

// GET /notifications/unread-count
notificationsRouter.get('/unread-count', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    const count = await Notification.countDocuments({
      user: userId,
      readAt: null,
    });
    res.json({ unreadCount: count });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch unread count' });
  }
});

// GET /notifications
notificationsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const unreadOnly = req.query.unread === 'true';

    const query: any = { user: userId };
    if (unreadOnly) {
      query.readAt = null;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ user: userId, readAt: null }),
    ]);

    res.json({
      data: notifications,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        unreadCount,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch notifications' });
  }
});

// PATCH /notifications/:id/read
notificationsRouter.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: userId },
      { $set: { readAt: new Date() } },
      { new: true }
    );

    if (!notification) {
      res.status(404).json({ message: 'Notification not found' });
      return;
    }

    res.json(notification);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to mark notification as read' });
  }
});

// POST /notifications/read-all
notificationsRouter.post('/read-all', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    await Notification.updateMany(
      { user: userId, readAt: null },
      { $set: { readAt: new Date() } }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to mark all as read' });
  }
});

// GET /notifications/preferences
notificationsRouter.get('/preferences', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    let prefDoc = await NotificationPreference.findOne({ user: userId });

    if (!prefDoc) {
      prefDoc = await NotificationPreference.create({
        user: userId,
        preferences: { ...DEFAULT_PREFERENCES },
      });
    }

    // Merge in any newly added preference keys
    const merged = { ...DEFAULT_PREFERENCES, ...(prefDoc.preferences || {}) };
    res.json({ preferences: merged });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch preferences' });
  }
});

// PUT /notifications/preferences
notificationsRouter.put('/preferences', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    const { preferences } = req.body;

    if (!preferences || typeof preferences !== 'object') {
      res.status(400).json({ message: 'Invalid preferences payload' });
      return;
    }

    let prefDoc = await NotificationPreference.findOne({ user: userId });
    if (!prefDoc) {
      prefDoc = new NotificationPreference({ user: userId, preferences });
    } else {
      prefDoc.preferences = { ...DEFAULT_PREFERENCES, ...(prefDoc.preferences || {}), ...preferences };
      prefDoc.markModified('preferences');
    }

    await prefDoc.save();
    res.json({ message: 'Preferences updated successfully', preferences: prefDoc.preferences });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to update preferences' });
  }
});
