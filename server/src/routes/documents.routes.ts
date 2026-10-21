import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { AuthRequest } from '../types/index.js';
import { DocumentModel } from '../models/Document.js';
import { recordAudit } from '../utils/auditLogger.js';

export const documentsRouter = Router();

documentsRouter.use(authenticate);

// Standard folder presets if tenant has none yet
const DEFAULT_FOLDERS = [
  'Proposals & Quotes',
  'Contracts & NDAs',
  'Pitch Decks & Presentations',
  'Product Collateral',
  'Customer Case Studies',
  'Legal & Compliance',
  'General',
];

// GET /documents - Search, filter, and fetch document file cabinet
documentsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { folder, search, status, entityType, entityId, starred, page = '1', limit = '50' } = req.query;

    const filter: Record<string, any> = {};

    if (folder && folder !== 'all') {
      filter.folder = folder;
    }

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (starred === 'true') {
      filter.isStarred = true;
    }

    if (entityType && entityType !== 'all') {
      filter['relatedTo.entityType'] = entityType;
    }

    if (entityId) {
      filter['relatedTo.entityId'] = entityId;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const s = search.trim();
      filter.$or = [
        { name: { $regex: s, $options: 'i' } },
        { description: { $regex: s, $options: 'i' } },
        { folder: { $regex: s, $options: 'i' } },
        { tags: { $in: [new RegExp(s, 'i')] } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    // Fetch documents excluding heavy base64 fileData by default in lists for high performance
    const [documents, totalCount, allTenantDocs] = await Promise.all([
      DocumentModel.find(filter)
        .select('-fileData')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('uploadedBy', '_id name email avatar'),
      DocumentModel.countDocuments(filter),
      DocumentModel.find({}, 'folder fileSize isStarred status'),
    ]);

    // Calculate folder counts & storage statistics
    const folderCountMap: Record<string, number> = {};
    for (const def of DEFAULT_FOLDERS) {
      folderCountMap[def] = 0;
    }

    let totalBytes = 0;
    let starredCount = 0;

    for (const d of allTenantDocs) {
      totalBytes += d.fileSize || 0;
      if (d.isStarred) starredCount++;
      folderCountMap[d.folder] = (folderCountMap[d.folder] || 0) + 1;
    }

    const folders = Object.keys(folderCountMap).map((name) => ({
      name,
      count: folderCountMap[name] || 0,
    }));

    res.json({
      documents,
      pagination: {
        total: totalCount,
        page: pageNum,
        pages: Math.ceil(totalCount / limitNum),
        limit: limitNum,
      },
      stats: {
        totalDocuments: allTenantDocs.length,
        totalBytes,
        starredCount,
        folders,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch documents' });
  }
});

// GET /documents/:id - Single document with file data
documentsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const document = await DocumentModel.findById(req.params.id).populate(
      'uploadedBy',
      '_id name email avatar'
    );

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (req.query.download === 'true') {
      document.downloadCount += 1;
      await document.save();
    }

    res.json(document);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch document' });
  }
});

// POST /documents - Upload / Create document
documentsRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      folder = 'General',
      fileType = 'pdf',
      fileSize = 0,
      fileData = '',
      version = '1.0',
      status = 'draft',
      tags = [],
      description = '',
      relatedTo,
      isShared = false,
      isStarred = false,
    } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Document name is required' });
    }

    const doc = await DocumentModel.create({
      name: name.trim(),
      folder: folder.trim() || 'General',
      fileType: fileType.toLowerCase().trim() || 'pdf',
      fileSize: Number(fileSize) || 0,
      fileData: fileData || '',
      version: version || '1.0',
      status,
      tags: Array.isArray(tags) ? tags : [],
      description: description?.trim() || '',
      relatedTo: relatedTo || { entityType: 'none' },
      uploadedBy: req.user!._id,
      downloadCount: 0,
      isShared: Boolean(isShared),
      isStarred: Boolean(isStarred),
    });

    await recordAudit({
      req,
      action: 'create',
      entityType: 'document',
      entityId: doc._id.toString(),
      entityLabel: doc.name,
      after: doc.toObject(),
    });

    const populated = await DocumentModel.findById(doc._id).populate(
      'uploadedBy',
      '_id name email avatar'
    );

    res.status(201).json(populated);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to create document' });
  }
});

// PUT /documents/:id - Update document metadata
documentsRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const doc = await DocumentModel.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const before = doc.toObject();

    const {
      name,
      folder,
      version,
      status,
      tags,
      description,
      relatedTo,
      isShared,
      isStarred,
    } = req.body;

    if (name !== undefined) doc.name = name.trim();
    if (folder !== undefined) doc.folder = folder.trim();
    if (version !== undefined) doc.version = version;
    if (status !== undefined) doc.status = status;
    if (tags !== undefined) doc.tags = Array.isArray(tags) ? tags : [];
    if (description !== undefined) doc.description = description;
    if (relatedTo !== undefined) doc.relatedTo = relatedTo;
    if (isShared !== undefined) doc.isShared = Boolean(isShared);
    if (isStarred !== undefined) doc.isStarred = Boolean(isStarred);

    await doc.save();

    await recordAudit({
      req,
      action: 'update',
      entityType: 'document',
      entityId: doc._id.toString(),
      entityLabel: doc.name,
      before,
      after: doc.toObject(),
    });

    const updated = await DocumentModel.findById(doc._id).populate(
      'uploadedBy',
      '_id name email avatar'
    );

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to update document' });
  }
});

// POST /documents/:id/star - Quick toggle star status
documentsRouter.post('/:id/star', async (req: AuthRequest, res: Response) => {
  try {
    const doc = await DocumentModel.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    doc.isStarred = !doc.isStarred;
    await doc.save();

    res.json({ _id: doc._id, isStarred: doc.isStarred });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to toggle star' });
  }
});

// DELETE /documents/:id - Delete document
documentsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const doc = await DocumentModel.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const before = doc.toObject();
    await DocumentModel.findByIdAndDelete(req.params.id);

    await recordAudit({
      req,
      action: 'delete',
      entityType: 'document',
      entityId: req.params.id,
      entityLabel: before.name,
      before,
    });

    res.json({ message: 'Document deleted successfully', _id: req.params.id });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to delete document' });
  }
});
