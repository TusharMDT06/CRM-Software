import { Router, Response } from 'express';
import { CompanySettings, getCompanySettings } from '../models/CompanySettings.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { companySettingsSchema } from '../validations/index.js';
import { AuthRequest } from '../types/index.js';

export const companySettingsRouter = Router();

companySettingsRouter.use(authenticate);

// GET /company-settings (Available to all authenticated users for builder defaults)
companySettingsRouter.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const settings = await getCompanySettings();
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch company settings' });
  }
});

// PUT /company-settings (Admin only)
companySettingsRouter.put(
  '/',
  requireRole('admin'),
  validateBody(companySettingsSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const data = req.body;

      // Validate logo size if provided as base64 (Max 1MB)
      if (data.logo && data.logo.startsWith('data:')) {
        const base64Content = data.logo.split(',')[1] || '';
        const sizeInBytes = (base64Content.length * 3) / 4;
        if (sizeInBytes > 1024 * 1024) {
          res.status(400).json({ message: 'Company logo exceeds 1 MB limit' });
          return;
        }
      }

      let settings = await CompanySettings.findOne();
      if (!settings) {
        settings = new CompanySettings(data);
      } else {
        Object.assign(settings, data);
      }

      settings.updatedBy = user._id;
      await settings.save();

      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to update company settings' });
    }
  }
);
