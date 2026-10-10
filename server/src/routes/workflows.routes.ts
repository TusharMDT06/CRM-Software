import { Router, Response } from 'express';
import { Workflow } from '../models/Workflow.js';
import { WorkflowRun } from '../models/WorkflowRun.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { workflowSchema, workflowUpdateSchema } from '../validations/index.js';
import { AuthRequest } from '../types/index.js';
import { dryRunWorkflow } from '../utils/workflowEngine.js';
import { logAudit } from '../utils/auditLogger.js';

export const workflowsRouter = Router();

// Only admin and manager can access workflow automations
workflowsRouter.use(authenticate);
workflowsRouter.use(requireRole('admin', 'manager'));

// GET /workflows
workflowsRouter.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const workflows = await Workflow.find()
      .populate('owner', 'name email role')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ data: workflows });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch workflows' });
  }
});

// POST /workflows
workflowsRouter.post(
  '/',
  validateBody(workflowSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const workflow = await Workflow.create({
        ...req.body,
        owner: user._id,
      });

      await workflow.populate('owner', 'name email role');

      await logAudit({
        req,
        action: 'create',
        entityType: 'workflow',
        entityId: workflow._id.toString(),
        entityLabel: workflow.name,
      });

      res.status(201).json(workflow);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to create workflow' });
    }
  }
);

// GET /workflows/:id
workflowsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const workflow = await Workflow.findById(req.params.id)
      .populate('owner', 'name email role')
      .lean();

    if (!workflow) {
      res.status(404).json({ message: 'Workflow not found' });
      return;
    }

    res.json(workflow);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch workflow' });
  }
});

// PUT /workflows/:id
workflowsRouter.put(
  '/:id',
  validateBody(workflowUpdateSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const workflow = await Workflow.findById(req.params.id);
      if (!workflow) {
        res.status(404).json({ message: 'Workflow not found' });
        return;
      }

      const prevObj = workflow.toObject();
      Object.assign(workflow, req.body);
      await workflow.save();
      await workflow.populate('owner', 'name email role');

      await logAudit({
        req,
        action: 'update',
        entityType: 'workflow',
        entityId: workflow._id.toString(),
        entityLabel: workflow.name,
        before: prevObj,
        after: workflow.toObject(),
      });

      res.json(workflow);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to update workflow' });
    }
  }
);

// PATCH /workflows/:id/toggle
workflowsRouter.patch('/:id/toggle', async (req: AuthRequest, res: Response) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) {
      res.status(404).json({ message: 'Workflow not found' });
      return;
    }

    const prevEnabled = workflow.enabled;
    workflow.enabled = !workflow.enabled;
    await workflow.save();

    await logAudit({
      req,
      action: 'update',
      entityType: 'workflow',
      entityId: workflow._id.toString(),
      entityLabel: workflow.name,
      changes: [{ field: 'enabled', from: prevEnabled, to: workflow.enabled }],
    });

    res.json({ message: `Workflow ${workflow.enabled ? 'enabled' : 'disabled'}`, workflow });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to toggle workflow' });
  }
});

// DELETE /workflows/:id
workflowsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) {
      res.status(404).json({ message: 'Workflow not found' });
      return;
    }

    await logAudit({
      req,
      action: 'delete',
      entityType: 'workflow',
      entityId: workflow._id.toString(),
      entityLabel: workflow.name,
    });

    await workflow.deleteOne();
    res.json({ message: 'Workflow deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to delete workflow' });
  }
});

// POST /workflows/:id/test (Dry-run against a chosen record)
workflowsRouter.post('/:id/test', async (req: AuthRequest, res: Response) => {
  try {
    const { entityType, entityId } = req.body;
    if (!entityType || !entityId) {
      res.status(400).json({ message: 'entityType and entityId are required for dry run' });
      return;
    }

    const dryRunResult = await dryRunWorkflow(req.params.id, entityType, entityId);
    res.json(dryRunResult);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Workflow test dry-run failed' });
  }
});

// GET /workflows/:id/runs
workflowsRouter.get('/:id/runs', async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

    const [runs, total] = await Promise.all([
      WorkflowRun.find({ workflow: req.params.id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      WorkflowRun.countDocuments({ workflow: req.params.id }),
    ]);

    res.json({
      data: runs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch workflow runs' });
  }
});
