import { FilterQuery } from 'mongoose';
import { IUser } from '../models/User.js';

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function buildOwnerFilter<T>(user: IUser, explicitOwner?: string): FilterQuery<T> {
  if (user.role === 'sales') {
    return { owner: user._id } as FilterQuery<T>;
  }
  if (explicitOwner) {
    return { owner: explicitOwner } as FilterQuery<T>;
  }
  return {} as FilterQuery<T>;
}

export function parseSort(sortParam?: string): Record<string, 1 | -1> {
  if (!sortParam) return { createdAt: -1 };
  const parts = sortParam.split(':');
  const field = parts[0] || 'createdAt';
  const order = parts[1] === 'asc' ? 1 : -1;
  return { [field]: order };
}
