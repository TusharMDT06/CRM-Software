import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  createUserSchema,
  updateUserSchema,
  inviteUserSchema,
} from '../validations/index.js';
import { AuthRequest } from '../types/index.js';
import { checkSeatLimit } from '../utils/planLimits.js';
import { runWithTenantContext } from '../utils/tenantContext.js';
import { recordAudit } from '../utils/auditLogger.js';
import { sendEmailDirect } from '../utils/notificationService.js';

export const usersRouter = Router();

// Apply auth to all user routes
usersRouter.use(authenticate);

// GET /users
// admin/manager: all in tenant, sales: self only
usersRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user!;
    let query: any = {};
    if (currentUser.role === 'sales') {
      query = { _id: currentUser._id };
    }

    const users = await User.find(query)
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch users' });
  }
});

// POST /users/invite (Admin & Manager)
usersRouter.post(
  '/invite',
  requireRole('admin', 'manager'),
  validateBody(inviteUserSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, email, role } = req.body;
      const cleanEmail = email.toLowerCase().trim();
      const tenantId = req.user!.tenantId!.toString();

      // Enforce seat limit before inviting
      await checkSeatLimit(tenantId);

      // Check if email already registered globally
      const existingUser = await runWithTenantContext(
        { isBypassTenant: true },
        async () => User.findOne({ email: cleanEmail })
      );

      if (existingUser) {
        res.status(400).json({ message: 'User with this email is already registered' });
        return;
      }

      const inviteToken = crypto.randomBytes(32).toString('hex');
      const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const newUser = await User.create({
        name: name.trim(),
        email: cleanEmail,
        passwordHash: await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10),
        role,
        tenantId: req.user!.tenantId,
        active: true,
        isVerified: true,
        inviteToken,
        inviteExpires,
      });

      // Send invite email
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      const inviteLink = `${clientUrl}/accept-invite?token=${inviteToken}`;
      await sendEmailDirect({
        to: cleanEmail,
        subject: `You've been invited to join Flowdesk CRM`,
        htmlBody: `<p>Hi ${name},</p><p>${req.user!.name} has invited you to join Flowdesk as <strong>${role}</strong>.</p><p><a href="${inviteLink}">Click here to accept your invitation and set your password</a>.</p><p>This link is valid for 7 days.</p>`,
        plainText: `Hi ${name},\n\n${req.user!.name} invited you to join Flowdesk as ${role}.\n\nAccept your invite here: ${inviteLink}\n\nValid for 7 days.`,
      });

      await recordAudit({
        actor: req.user!._id,
        actorName: req.user!.name,
        source: 'user',
        action: 'create',
        entityType: 'user',
        entityId: newUser._id.toString(),
        entityLabel: newUser.name,
        changes: [{ field: 'invited', from: null, to: cleanEmail }],
        req,
      });

      res.status(201).json({
        message: 'Invitation sent successfully',
        user: {
          _id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          active: newUser.active,
          createdAt: newUser.createdAt,
        },
        inviteToken,
      });
    } catch (error: any) {
      if (error.name === 'PlanLimitError') {
        res.status(403).json({ message: error.message });
        return;
      }
      res.status(500).json({ message: error.message || 'Failed to send invite' });
    }
  }
);

// POST /users (Admin only direct user creation)
usersRouter.post(
  '/',
  requireRole('admin'),
  validateBody(createUserSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, email, password, role, active } = req.body;
      const cleanEmail = email.toLowerCase().trim();
      const tenantId = req.user!.tenantId!.toString();

      // Enforce seat limit
      await checkSeatLimit(tenantId);

      const existingUser = await runWithTenantContext(
        { isBypassTenant: true },
        async () => User.findOne({ email: cleanEmail })
      );

      if (existingUser) {
        res.status(400).json({ message: 'User with this email already exists' });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const newUser = await User.create({
        name,
        email: cleanEmail,
        passwordHash,
        role,
        tenantId: req.user!.tenantId,
        active: active !== undefined ? active : true,
        isVerified: true,
      });

      await recordAudit({
        actor: req.user!._id,
        actorName: req.user!.name,
        source: 'user',
        action: 'create',
        entityType: 'user',
        entityId: newUser._id.toString(),
        entityLabel: newUser.name,
        changes: [{ field: 'email', from: null, to: cleanEmail }],
        req,
      });

      res.status(201).json({
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        active: newUser.active,
        createdAt: newUser.createdAt,
      });
    } catch (error: any) {
      if (error.name === 'PlanLimitError') {
        res.status(403).json({ message: error.message });
        return;
      }
      res.status(500).json({ message: error.message || 'Failed to create user' });
    }
  }
);

// PATCH /users/:id (Admin only)
usersRouter.patch(
  '/:id',
  requireRole('admin'),
  validateBody(updateUserSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, email, password, role, active } = req.body;

      const user = await User.findById(id);
      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }

      const beforeUser = user.toObject();

      if (name) user.name = name;
      if (email && email.toLowerCase() !== user.email) {
        const emailExists = await runWithTenantContext(
          { isBypassTenant: true },
          async () => User.findOne({ email: email.toLowerCase(), _id: { $ne: id } })
        );
        if (emailExists) {
          res.status(400).json({ message: 'Email is already in use by another user' });
          return;
        }
        user.email = email.toLowerCase();
      }
      if (password) {
        user.passwordHash = await bcrypt.hash(password, 10);
      }
      if (role) {
        // Prevent demoting the only admin
        if (user.role === 'admin' && role !== 'admin') {
          const adminCount = await User.countDocuments({ role: 'admin', active: true });
          if (adminCount <= 1) {
            res.status(400).json({ message: 'Cannot demote the last active admin' });
            return;
          }
        }
        user.role = role;
      }
      if (active !== undefined) {
        if (req.user?._id.equals(user._id) && !active) {
          res.status(400).json({ message: 'You cannot deactivate your own account' });
          return;
        }
        user.active = active;
      }

      await user.save();

      await recordAudit({
        actor: req.user!._id,
        actorName: req.user!.name,
        source: 'user',
        action: 'update',
        entityType: 'user',
        entityId: user._id.toString(),
        entityLabel: user.name,
        before: beforeUser,
        after: user.toObject(),
        req,
      });

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
        updatedAt: user.updatedAt,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to update user' });
    }
  }
);
