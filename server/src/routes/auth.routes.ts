import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { User } from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { bootstrapSchema, loginSchema } from '../validations/index.js';
import { AuthRequest } from '../types/index.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 500 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again after 15 minutes.' },
});

function signToken(userId: string): string {
  const secret = process.env.JWT_SECRET || 'flowdesk_super_secret_jwt_key_2026_crm';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign({ userId }, secret, { expiresIn } as jwt.SignOptions);
}

// POST /auth/bootstrap (Works only when no users exist)
authRouter.post('/bootstrap', validateBody(bootstrapSchema), async (req, res: Response) => {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      res.status(400).json({ message: 'Bootstrap is only allowed when no users exist' });
      return;
    }

    const { name, email, password } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: 'admin',
      active: true,
    });

    const token = signToken(user._id.toString());
    res.status(201).json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to bootstrap admin user' });
  }
});

// POST /auth/login
authRouter.post('/login', loginLimiter, validateBody(loginSchema), async (req, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    if (!user.active) {
      res.status(403).json({ message: 'Your account is deactivated. Please contact an admin.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    const token = signToken(user._id.toString());
    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Login failed' });
  }
});

// GET /auth/me
authRouter.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  res.json({
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      createdAt: user.createdAt,
    },
  });
});
