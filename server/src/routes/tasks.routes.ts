import { Router, Response } from 'express';
import { FilterQuery } from 'mongoose';
import { Task } from '../models/Task.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { requireWithinRecordLimit } from '../middleware/planLimits.js';
import { taskSchema, taskUpdateSchema } from '../validations/index.js';
import { AuthRequest } from '../types/index.js';
import { buildOwnerFilter, parseSort } from '../utils/queryHelper.js';
import { logActivity } from '../utils/activityHelper.js';
import { paginateQuery } from '../utils/paginationHelper.js';
import { hasVersionConflict, sendConflictResponse } from '../utils/conflictHelper.js';

export const tasksRouter = Router();

tasksRouter.use(authenticate);

// GET /tasks
tasksRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;

    const query: FilterQuery<any> = {
      ...buildOwnerFilter(user, req.query.owner as string),
    };

    if (req.query.status) {
      query.status = req.query.status;
    }
    if (req.query.priority) {
      query.priority = req.query.priority;
    }
    if (req.query.type) {
      query.type = req.query.type;
    }
    if (req.query.deal) {
      query.deal = req.query.deal;
    }

    if (req.query.q) {
      const q = String(req.query.q).trim();
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ];
    }

    const result = await paginateQuery(Task, query, req.query, {
      populate: [
        { path: 'deal', select: 'title stage amount' },
        { path: 'owner', select: 'name email role' },
      ],
      defaultSort: { dueDate: 1 },
      defaultLimit: 10,
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch tasks' });
  }
});

// GET /tasks/:id
tasksRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const task = await Task.findById(req.params.id)
      .populate('deal', 'title stage amount')
      .populate('owner', 'name email role');

    if (!task) {
      res.status(404).json({ message: 'Task not found' });
      return;
    }

    if (user.role === 'sales' && !task.owner.equals(user._id)) {
      res.status(404).json({ message: 'Task not found' });
      return;
    }

    res.json(task);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch task' });
  }
});

// POST /tasks
tasksRouter.post('/', requireWithinRecordLimit, validateBody(taskSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const taskData = { ...req.body };

    if (user.role === 'sales' || !taskData.owner) {
      taskData.owner = user._id;
    }

    // Convert empty string deal to null
    if (!taskData.deal) {
      taskData.deal = null;
    }

    const task = await Task.create(taskData);
    await task.populate('deal', 'title stage amount');
    await task.populate('owner', 'name email role');

    res.status(201).json(task);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to create task' });
  }
});

// PATCH /tasks/:id
tasksRouter.patch('/:id', validateBody(taskUpdateSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const task = await Task.findById(req.params.id);

    if (!task) {
      res.status(404).json({ message: 'Task not found' });
      return;
    }

    if (user.role === 'sales') {
      if (!task.owner.equals(user._id)) {
        res.status(403).json({ message: 'Forbidden: You can only edit tasks you own' });
        return;
      }
      delete req.body.owner;
    }

    if (req.body.deal === '') {
      req.body.deal = null;
    }

    if (hasVersionConflict(task, req.body)) {
      await task.populate('deal', 'title stage amount');
      await task.populate('owner', 'name email role');
      sendConflictResponse(res, task);
      return;
    }

    const oldStatus = task.status;
    Object.assign(task, req.body);
    await task.save();
    await task.populate('deal', 'title stage amount');
    await task.populate('owner', 'name email role');

    if (req.body.status === 'done' && oldStatus !== 'done') {
      if (task.deal) {
        const dealId = typeof task.deal === 'object' ? (task.deal as any)._id : task.deal;
        await logActivity({
          type: 'task',
          subject: `Task completed: ${task.title}`,
          body: task.description || '',
          entityType: 'deal',
          entityId: dealId,
          createdBy: user._id,
        });
      }
    }

    res.json(task);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to update task' });
  }
});

// DELETE /tasks/:id (admin/manager only)
tasksRouter.delete('/:id', requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      res.status(404).json({ message: 'Task not found' });
      return;
    }
    res.json({ message: 'Task deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to delete task' });
  }
});
