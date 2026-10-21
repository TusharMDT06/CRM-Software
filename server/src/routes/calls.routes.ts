import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { authenticate } from '../middleware/auth.js';
import { AuthRequest } from '../types/index.js';
import { Call } from '../models/Call.js';
import { Activity } from '../models/Activity.js';
import { recordAudit } from '../utils/auditLogger.js';

export const callsRouter = Router();

callsRouter.use(authenticate);

// GET /calls - List, search, and filter call logs
callsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      search,
      callType, // 'outbound', 'inbound', 'scheduled', or 'all'
      callResult,
      owner,
      entityType,
      entityId,
      page = '1',
      limit = '50',
    } = req.query;

    const filter: Record<string, any> = {};

    if (callType && callType !== 'all') {
      filter.callType = callType;
    }

    if (callResult && callResult !== 'all') {
      filter.callResult = callResult;
    }

    if (owner && Types.ObjectId.isValid(owner as string)) {
      filter.owner = new Types.ObjectId(owner as string);
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
        { subject: { $regex: s, $options: 'i' } },
        { contactName: { $regex: s, $options: 'i' } },
        { phoneNumber: { $regex: s, $options: 'i' } },
        { notes: { $regex: s, $options: 'i' } },
        { 'relatedTo.entityName': { $regex: s, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [calls, totalCount, allCalls] = await Promise.all([
      Call.find(filter)
        .populate('owner', '_id name email role')
        .sort({ startTime: -1 })
        .skip(skip)
        .limit(limitNum),
      Call.countDocuments(filter),
      Call.find({}, 'callType durationSeconds callResult'),
    ]);

    let outboundCount = 0;
    let inboundCount = 0;
    let scheduledCount = 0;
    let totalDurationSeconds = 0;

    for (const c of allCalls) {
      totalDurationSeconds += c.durationSeconds || 0;
      if (c.callType === 'outbound') outboundCount++;
      if (c.callType === 'inbound') inboundCount++;
      if (c.callType === 'scheduled') scheduledCount++;
    }

    res.json({
      calls,
      pagination: {
        total: totalCount,
        page: pageNum,
        pages: Math.ceil(totalCount / limitNum),
        limit: limitNum,
      },
      stats: {
        totalCalls: allCalls.length,
        outboundCount,
        inboundCount,
        scheduledCount,
        totalDurationSeconds,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch calls' });
  }
});

// GET /calls/:id
callsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const call = await Call.findById(req.params.id).populate('owner', '_id name email role');
    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }
    res.json(call);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch call' });
  }
});

// POST /calls - Log or Schedule Call
callsRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const {
      subject,
      callType = 'outbound',
      callPurpose = 'follow_up',
      startTime = new Date(),
      durationSeconds = 0,
      callResult = 'connected',
      relatedTo,
      contactName = '',
      phoneNumber = '',
      owner,
      notes = '',
      followUpAction = '',
    } = req.body;

    if (!subject || typeof subject !== 'string' || !subject.trim()) {
      return res.status(400).json({ message: 'Call subject is required' });
    }

    const call = await Call.create({
      subject: subject.trim(),
      callType,
      callPurpose,
      startTime: new Date(startTime),
      durationSeconds: Number(durationSeconds) || 0,
      callResult,
      relatedTo: relatedTo || { entityType: 'none' },
      contactName: contactName.trim(),
      phoneNumber: phoneNumber.trim(),
      owner: owner && Types.ObjectId.isValid(owner) ? owner : user._id,
      notes: notes.trim(),
      followUpAction: followUpAction.trim(),
    });

    // Mirror to Activity Timeline if linked to an entity
    if (relatedTo && relatedTo.entityType && relatedTo.entityType !== 'none' && relatedTo.entityId) {
      await Activity.create({
        type: 'call',
        subject: `Call logged: ${call.subject}`,
        body: notes || `Call with ${contactName || 'client'} - Result: ${callResult}`,
        entityType: relatedTo.entityType,
        entityId: relatedTo.entityId,
        createdBy: user._id,
        occurredAt: new Date(startTime),
        durationMins: Math.round(call.durationSeconds / 60),
        outcome: callResult === 'connected' ? 'connected' : callResult === 'left_voicemail' ? 'left_message' : 'no_answer',
      }).catch(() => {});
    }

    await recordAudit({
      req,
      action: 'create',
      entityType: 'call',
      entityId: call._id.toString(),
      entityLabel: call.subject,
      after: call.toObject(),
    });

    const populated = await Call.findById(call._id).populate('owner', '_id name email role');
    res.status(201).json(populated);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to log call' });
  }
});

// PUT /calls/:id - Update Call
callsRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const call = await Call.findById(req.params.id);
    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    const before = call.toObject();

    const {
      subject,
      callType,
      callPurpose,
      startTime,
      durationSeconds,
      callResult,
      relatedTo,
      contactName,
      phoneNumber,
      owner,
      notes,
      followUpAction,
    } = req.body;

    if (subject !== undefined) call.subject = subject.trim();
    if (callType !== undefined) call.callType = callType;
    if (callPurpose !== undefined) call.callPurpose = callPurpose;
    if (startTime !== undefined) call.startTime = new Date(startTime);
    if (durationSeconds !== undefined) call.durationSeconds = Number(durationSeconds);
    if (callResult !== undefined) call.callResult = callResult;
    if (relatedTo !== undefined) call.relatedTo = relatedTo;
    if (contactName !== undefined) call.contactName = contactName.trim();
    if (phoneNumber !== undefined) call.phoneNumber = phoneNumber.trim();
    if (owner !== undefined && Types.ObjectId.isValid(owner)) call.owner = owner;
    if (notes !== undefined) call.notes = notes.trim();
    if (followUpAction !== undefined) call.followUpAction = followUpAction.trim();

    await call.save();

    await recordAudit({
      req,
      action: 'update',
      entityType: 'call',
      entityId: call._id.toString(),
      entityLabel: call.subject,
      before,
      after: call.toObject(),
    });

    const updated = await Call.findById(call._id).populate('owner', '_id name email role');
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to update call' });
  }
});

// DELETE /calls/:id - Delete Call
callsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const call = await Call.findById(req.params.id);
    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    const before = call.toObject();
    await Call.findByIdAndDelete(req.params.id);

    await recordAudit({
      req,
      action: 'delete',
      entityType: 'call',
      entityId: req.params.id,
      entityLabel: before.subject,
      before,
    });

    res.json({ message: 'Call deleted successfully', _id: req.params.id });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to delete call' });
  }
});
