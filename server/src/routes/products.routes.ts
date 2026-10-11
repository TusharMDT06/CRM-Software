import { Router, Response } from 'express';
import { FilterQuery } from 'mongoose';
import { Product } from '../models/Product.js';
import { Quote } from '../models/Quote.js';
import { Invoice } from '../models/Invoice.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { requireWithinRecordLimit } from '../middleware/planLimits.js';
import { productSchema, productUpdateSchema } from '../validations/index.js';
import { AuthRequest } from '../types/index.js';
import { parseSort } from '../utils/queryHelper.js';

export const productsRouter = Router();

productsRouter.use(authenticate);

// GET /products
productsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 25));
    const skip = (page - 1) * limit;

    const query: FilterQuery<any> = {};

    // Active filter
    if (req.query.active !== undefined && req.query.active !== '') {
      query.active = req.query.active === 'true';
    }

    // Search query
    if (req.query.q) {
      const q = String(req.query.q).trim();
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { sku: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ];
    }

    const sort = parseSort(req.query.sort as string) || { name: 1 };

    const [data, total] = await Promise.all([
      Product.find(query)
        .populate('owner', 'name email role')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Product.countDocuments(query),
    ]);

    res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch products' });
  }
});

// GET /products/:id
productsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const product = await Product.findById(req.params.id).populate('owner', 'name email role');
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    res.json(product);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch product' });
  }
});

// POST /products
productsRouter.post('/', requireWithinRecordLimit, validateBody(productSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { sku, ...body } = req.body;

    // Check unique SKU
    const existing = await Product.findOne({ sku: sku.trim().toUpperCase() });
    if (existing) {
      res.status(400).json({ message: `A product with SKU "${sku}" already exists` });
      return;
    }

    const product = await Product.create({
      ...body,
      sku: sku.trim().toUpperCase(),
      owner: user.role === 'sales' ? user._id : body.owner || user._id,
    });

    await product.populate('owner', 'name email role');
    res.status(201).json(product);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to create product' });
  }
});

// PATCH /products/:id
productsRouter.patch('/:id', validateBody(productUpdateSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const product = await Product.findById(req.params.id);

    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    // Role check: sales can only edit their own products
    if (user.role === 'sales' && String(product.owner) !== String(user._id)) {
      res.status(403).json({ message: 'Forbidden: You can only edit products you own' });
      return;
    }

    if (req.body.sku && req.body.sku.trim().toUpperCase() !== product.sku) {
      const existing = await Product.findOne({ sku: req.body.sku.trim().toUpperCase() });
      if (existing) {
        res.status(400).json({ message: `A product with SKU "${req.body.sku}" already exists` });
        return;
      }
      product.sku = req.body.sku.trim().toUpperCase();
    }

    Object.assign(product, req.body);
    await product.save();
    await product.populate('owner', 'name email role');

    res.json(product);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to update product' });
  }
});

// PATCH /products/:id/toggle-active
productsRouter.patch('/:id/toggle-active', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const product = await Product.findById(req.params.id);

    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    if (user.role === 'sales' && String(product.owner) !== String(user._id)) {
      res.status(403).json({ message: 'Forbidden: You can only toggle status on products you own' });
      return;
    }

    product.active = !product.active;
    await product.save();
    await product.populate('owner', 'name email role');

    res.json(product);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to toggle product status' });
  }
});

// DELETE /products/:id
productsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const product = await Product.findById(req.params.id);

    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    // Only admin or manager or product owner can delete
    if (user.role === 'sales' && String(product.owner) !== String(user._id)) {
      res.status(403).json({ message: 'Forbidden: You do not have permission to delete this product' });
      return;
    }

    // RULE: Never hard delete a product used in a quote or invoice
    const [inQuote, inInvoice] = await Promise.all([
      Quote.exists({ 'items.product': product._id }),
      Invoice.exists({ 'items.product': product._id }),
    ]);

    if (inQuote || inInvoice) {
      res.status(400).json({
        message: 'Cannot delete product: It is referenced in existing quotes or invoices. Please deactivate it instead.',
      });
      return;
    }

    await product.deleteOne();
    res.json({ message: 'Product deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to delete product' });
  }
});
