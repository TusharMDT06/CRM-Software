export interface CursorPaginationParams {
  cursor?: string;
  limit?: number;
  updatedSince?: string;
  q?: string;
  [key: string]: any;
}

export interface CursorPaginationResult<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
    // Page compatibility
    page?: number;
    totalPages?: number;
  };
}

export type CursorPaginatedResponse<T> = CursorPaginationResult<T>;

export interface ConflictResponse<T> {
  message: string;
  error: 'VERSION_CONFLICT';
  currentDocument: T;
}

export interface DeviceRegistrationInput {
  expoPushToken: string;
  platform: 'ios' | 'android' | 'web';
  appVersion?: string;
}

export interface DeviceRecord {
  _id: string;
  tenantId: string;
  user: string;
  expoPushToken: string;
  platform: 'ios' | 'android' | 'web';
  appVersion?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}
