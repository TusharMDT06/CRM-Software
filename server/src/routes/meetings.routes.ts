import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { authenticate } from '../middleware/auth.js';
import { AuthRequest } from '../types/index.js';
import { Meeting } from '../models/Meeting.js';
import { Activity } from '../models/Activity.js';
import { recordAudit } from '../utils/auditLogger.js';

export const meetingsRouter = Router();

meetingsRouter.use(authenticate);

// GET /meetings - List, search, and filter meetings
meetingsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const {
      search,
      status,
      view = 'all', // 'all', 'upcoming', 'today', 'completed', 'my'
      host,
      entityType,
      entityId,
      page = '1',
      limit = '50',
    } = req.query;

    const filter: Record<string, any> = {};

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (view === 'upcoming') {
      filter.to = { $gte: now };
      filter.status = { $in: ['scheduled', 'in_progress'] };
    } else if (view === 'today') {
      filter.from = { $gte: startOfToday, $lte: endOfToday };
    } else if (view === 'completed') {
      filter.status = 'completed';
    } else if (view === 'my') {
      filter.host = user._id;
    }

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (host && Types.ObjectId.isValid(host as string)) {
      filter.host = new Types.ObjectId(host as string);
    }

    if (entityType && entityType !== 'all') {
      filter['relatedTo.entityType'] = entityType;
    }

    if (entityId && Types.ObjectId.isValid(entityId as string)) {
      filter['relatedTo.entityId'] = new Types.ObjectId(entityId as string);
    }

    if (search && typeof search === 'string' && search.trim()) {
      const s = search.trim();
      filter.$or = [
        { title: { $regex: s, $options: 'i' } },
        { contactName: { $regex: s, $options: 'i' } },
        { agenda: { $regex: s, $options: 'i' } },
        { 'relatedTo.entityName': { $regex: s, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [meetings, totalCount, allMeetings] = await Promise.all([
      Meeting.find(filter)
        .populate('host', '_id name email role')
        .sort({ from: 1 })
        .skip(skip)
        .limit(limitNum),
      Meeting.countDocuments(filter),
      Meeting.find({}, 'from to status host'),
    ]);

    let upcomingCount = 0;
    let todayCount = 0;
    let completedCount = 0;

    for (const m of allMeetings) {
      if (m.status === 'completed') completedCount++;
      if (m.to >= now && m.status !== 'cancelled' && m.status !== 'completed') upcomingCount++;
      if (m.from >= startOfToday && m.from <= endOfToday) todayCount++;
    }

    res.json({
      meetings,
      pagination: {
        total: totalCount,
        page: pageNum,
        pages: Math.ceil(totalCount / limitNum),
        limit: limitNum,
      },
      stats: {
        totalMeetings: allMeetings.length,
        upcomingCount,
        todayCount,
        completedCount,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch meetings' });
  }
});

// GET /meetings/:id
meetingsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const meeting = await Meeting.findById(req.params.id).populate('host', '_id name email role');
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    res.json(meeting);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch meeting' });
  }
});

// POST /meetings - Create Meeting
meetingsRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const {
      title,
      from,
      to,
      allDay = false,
      status = 'scheduled',
      locationType = 'google_meet',
      locationDetails = '',
      meetingUrl = '',
      relatedTo,
      contactName = '',
      contactEmail = '',
      host,
      participants = [],
      agenda = '',
      outcome = '',
      reminderMinutes = 15,
    } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ message: 'Meeting title is required' });
    }

    if (!from || !to) {
      return res.status(400).json({ message: 'Meeting start and end time are required' });
    }

    const meeting = await Meeting.create({
      title: title.trim(),
      from: new Date(from),
      to: new Date(to),
      allDay: Boolean(allDay),
      status,
      locationType,
      locationDetails,
      meetingUrl: meetingUrl.trim(),
      relatedTo: relatedTo || { entityType: 'none' },
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim(),
      host: host && Types.ObjectId.isValid(host) ? host : user._id,
      participants: Array.isArray(participants) ? participants : [],
      agenda: agenda.trim(),
      outcome: outcome.trim(),
      reminderMinutes: Number(reminderMinutes) || 15,
    });

    // Mirror to Activity Timeline if linked to an entity
    if (relatedTo && relatedTo.entityType && relatedTo.entityType !== 'none' && relatedTo.entityId) {
      await Activity.create({
        type: 'meeting',
        subject: `Meeting scheduled: ${meeting.title}`,
        body: agenda || `Meeting with ${contactName || 'client'} on ${new Date(from).toLocaleDateString()}`,
        entityType: relatedTo.entityType,
        entityId: relatedTo.entityId,
        createdBy: user._id,
        occurredAt: new Date(from),
      }).catch(() => {});
    }

    await recordAudit({
      req,
      action: 'create',
      entityType: 'meeting',
      entityId: meeting._id.toString(),
      entityLabel: meeting.title,
      after: meeting.toObject(),
    });

    const populated = await Meeting.findById(meeting._id).populate('host', '_id name email role');
    res.status(201).json(populated);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to create meeting' });
  }
});

// PUT /meetings/:id - Update Meeting
meetingsRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    const before = meeting.toObject();

    const {
      title,
      from,
      to,
      allDay,
      status,
      locationType,
      locationDetails,
      meetingUrl,
      relatedTo,
      contactName,
      contactEmail,
      host,
      participants,
      agenda,
      outcome,
      reminderMinutes,
    } = req.body;

    if (title !== undefined) meeting.title = title.trim();
    if (from !== undefined) meeting.from = new Date(from);
    if (to !== undefined) meeting.to = new Date(to);
    if (allDay !== undefined) meeting.allDay = Boolean(allDay);
    if (status !== undefined) meeting.status = status;
    if (locationType !== undefined) meeting.locationType = locationType;
    if (locationDetails !== undefined) meeting.locationDetails = locationDetails;
    if (meetingUrl !== undefined) meeting.meetingUrl = meetingUrl.trim();
    if (relatedTo !== undefined) meeting.relatedTo = relatedTo;
    if (contactName !== undefined) meeting.contactName = contactName.trim();
    if (contactEmail !== undefined) meeting.contactEmail = contactEmail.trim();
    if (host !== undefined && Types.ObjectId.isValid(host)) meeting.host = host;
    if (participants !== undefined) meeting.participants = Array.isArray(participants) ? participants : [];
    if (agenda !== undefined) meeting.agenda = agenda.trim();
    if (outcome !== undefined) meeting.outcome = outcome.trim();
    if (reminderMinutes !== undefined) meeting.reminderMinutes = Number(reminderMinutes);

    await meeting.save();

    await recordAudit({
      req,
      action: 'update',
      entityType: 'meeting',
      entityId: meeting._id.toString(),
      entityLabel: meeting.title,
      before,
      after: meeting.toObject(),
    });

    const updated = await Meeting.findById(meeting._id).populate('host', '_id name email role');
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to update meeting' });
  }
});

// DELETE /meetings/:id - Delete Meeting
meetingsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    const before = meeting.toObject();
    await Meeting.findByIdAndDelete(req.params.id);

    await recordAudit({
      req,
      action: 'delete',
      entityType: 'meeting',
      entityId: req.params.id,
      entityLabel: before.title,
      before,
    });

    res.json({ message: 'Meeting deleted successfully', _id: req.params.id });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to delete meeting' });
  }
});
