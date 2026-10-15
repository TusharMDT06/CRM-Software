import { Types } from 'mongoose';
import { parseSort } from './queryHelper.js';

export interface DecodedCursor {
  id: string;
  timestamp?: Date;
}

export function encodeCursor(doc: any): string {
  if (!doc) return '';
  const id = doc._id ? doc._id.toString() : '';
  const dateVal = doc.createdAt || doc.updatedAt || new Date();
  const iso = dateVal instanceof Date ? dateVal.toISOString() : String(dateVal);
  const raw = `${id}:${iso}`;
  return Buffer.from(raw, 'utf-8').toString('base64');
}

export function decodeCursor(cursorStr?: string): DecodedCursor | null {
  if (!cursorStr) return null;
  try {
    // If it's a valid 24-hex string, treat directly as id
    if (Types.ObjectId.isValid(cursorStr) && cursorStr.length === 24) {
      return { id: cursorStr };
    }

    const decoded = Buffer.from(cursorStr, 'base64').toString('utf-8');
    const colonIndex = decoded.indexOf(':');
    if (colonIndex > 0) {
      const id = decoded.slice(0, colonIndex);
      const iso = decoded.slice(colonIndex + 1);
      if (id && Types.ObjectId.isValid(id)) {
        return {
          id,
          timestamp: iso ? new Date(iso) : undefined,
        };
      }
    }
  } catch (err) {
    // Fallback if raw string
    if (cursorStr.length === 24) {
      return { id: cursorStr };
    }
  }
  return null;
}

export interface PaginateOptions {
  populate?: any[];
  defaultSort?: Record<string, 1 | -1>;
  defaultLimit?: number;
  maxLimit?: number;
}

export async function paginateQuery<T>(
  model: any,
  queryFilter: any,
  reqQuery: any,
  options: PaginateOptions = {}
): Promise<{
  data: T[];
  pagination: {
    total: number;
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
    page: number;
    totalPages: number;
  };
}> {
  const defaultLimit = options.defaultLimit || 20;
  const maxLimit = options.maxLimit || 100;
  const limit = Math.min(maxLimit, Math.max(1, parseInt(reqQuery.limit as string) || defaultLimit));
  const sort = reqQuery.sort ? parseSort(reqQuery.sort as string) : options.defaultSort || { createdAt: -1 };

  const effectiveFilter = { ...queryFilter };

  // 1. updatedSince parameter
  if (reqQuery.updatedSince) {
    const updatedSinceDate = new Date(reqQuery.updatedSince as string);
    if (!isNaN(updatedSinceDate.getTime())) {
      effectiveFilter.updatedAt = { $gt: updatedSinceDate };
    }
  }

  // 2. Cursor pagination vs Page pagination
  const cursorParam = reqQuery.cursor as string;
  const isCursor = Boolean(cursorParam);

  if (isCursor) {
    const decoded = decodeCursor(cursorParam);
    if (decoded?.id) {
      // For descending sort (default), next records have _id < cursorId
      effectiveFilter._id = { $lt: new Types.ObjectId(decoded.id) };
    }
  }

  const page = Math.max(1, parseInt(reqQuery.page as string) || 1);
  const skip = isCursor ? 0 : (page - 1) * limit;

  // We query (limit + 1) to effortlessly know if hasMore is true
  let query = model.find(effectiveFilter).sort(sort).skip(skip).limit(limit + 1);

  if (options.populate && Array.isArray(options.populate)) {
    for (const pop of options.populate) {
      query = query.populate(pop);
    }
  }

  const [rawDocs, total] = await Promise.all([
    query.exec(),
    model.countDocuments(queryFilter),
  ]);

  const hasMore = rawDocs.length > limit;
  const docs = hasMore ? rawDocs.slice(0, limit) : rawDocs;

  const lastDoc = docs.length > 0 ? docs[docs.length - 1] : null;
  const nextCursor = hasMore && lastDoc ? encodeCursor(lastDoc) : null;

  return {
    data: docs,
    pagination: {
      total,
      limit,
      nextCursor,
      hasMore,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}
