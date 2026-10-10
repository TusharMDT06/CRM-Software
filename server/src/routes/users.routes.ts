import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createUserSchema, updateUserSchema } from '../validations/index.js';
import { AuthRequest } from '../types/index.js';

export const usersRouter = Router();

// Apply auth to all user routes
usersRouter.use(authenticate);

// GET /users
// admin/manager: all, sales: self only
usersRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user!;
    let query = {};
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

// POST /users (Admin only)
usersRouter.post('/', requireRole('admin'), validateBody(createUserSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password, role, active } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(400).json({ message: 'User with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role,
      active: active !== undefined ? active : true,
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
    res.status(500).json({ message: error.message || 'Failed to create user' });
  }
});

// PATCH /users/:id (Admin only)
usersRouter.patch('/:id', requireRole('admin'), validateBody(updateUserSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, password, role, active } = req.body;

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (name) user.name = name;
    if (email && email.toLowerCase() !== user.email) {
      const emailExists = await User.findOne({ email: email.toLowerCase(), _id: { $ne: id } });
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
      // Prevent deactivating own account if admin
      if (req.user?._id.equals(user._id) && !active) {
        res.status(400).json({ message: 'You cannot deactivate your own account' });
        return;
      }
      user.active = active;
    }

    await user.save();

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
});
