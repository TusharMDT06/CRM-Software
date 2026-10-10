import { Router, Response } from 'express';
import { FieldDefinition } from '../models/FieldDefinition.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  fieldDefinitionSchema,
  fieldDefinitionUpdateSchema,
} from '../validations/index.js';
import { AuthRequest } from '../types/index.js';

export const customFieldsRouter = Router();

customFieldsRouter.use(authenticate);

// GET /custom-fields (all users can view definitions to render forms & tables)
customFieldsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { entity, includeInactive } = req.query;
    const query: any = {};

    if (entity) {
      query.entity = entity;
    }
    // Only return active unless requested by admin
    if (includeInactive !== 'true' || req.user?.role !== 'admin') {
      query.active = true;
    }

    const fields = await FieldDefinition.find(query).sort({ order: 1, createdAt: 1 });
    res.json(fields);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch custom field definitions' });
  }
});

// POST /custom-fields (Admin only)
customFieldsRouter.post(
  '/',
  requireRole('admin'),
  validateBody(fieldDefinitionSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { entity, key, label, type, options, required, order, active } = req.body;

      // Check if key already exists for this entity
      const existing = await FieldDefinition.findOne({ entity, key });
      if (existing) {
        res.status(400).json({ message: `Field with key "${key}" already exists for ${entity}` });
        return;
      }

      const field = await FieldDefinition.create({
        entity,
        key,
        label,
        type,
        options: options || [],
        required: required || false,
        order: order || 0,
        active: active !== undefined ? active : true,
      });

      res.status(201).json(field);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to create field definition' });
    }
  }
);

// PATCH /custom-fields/reorder (Admin only)
customFieldsRouter.patch(
  '/reorder',
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orders } = req.body;
      if (!Array.isArray(orders)) {
        res.status(400).json({ message: 'Orders must be an array of { id, order }' });
        return;
      }

      await Promise.all(
        orders.map((item) =>
          FieldDefinition.findByIdAndUpdate(item.id, { order: item.order })
        )
      );

      res.json({ message: 'Field orders updated successfully' });
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to reorder fields' });
    }
  }
);

// PATCH /custom-fields/:id (Admin only)
customFieldsRouter.patch(
  '/:id',
  requireRole('admin'),
  validateBody(fieldDefinitionUpdateSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const field = await FieldDefinition.findById(req.params.id);
      if (!field) {
        res.status(404).json({ message: 'Field definition not found' });
        return;
      }

      // Key, entity, and type are immutable
      const { label, options, required, order, active } = req.body;
      if (label !== undefined) field.label = label;
      if (options !== undefined) field.options = options;
      if (required !== undefined) field.required = required;
      if (order !== undefined) field.order = order;
      if (active !== undefined) field.active = active;

      await field.save();
      res.json(field);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to update field definition' });
    }
  }
);

// DELETE /custom-fields/:id (Admin only) - soft delete (active = false)
customFieldsRouter.delete(
  '/:id',
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const field = await FieldDefinition.findById(req.params.id);
      if (!field) {
        res.status(404).json({ message: 'Field definition not found' });
        return;
      }

      // Soft delete: never hard delete so existing record data is maintained
      field.active = false;
      await field.save();

      res.json({ message: 'Field deactivated successfully', field });
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to deactivate field definition' });
    }
  }
);
