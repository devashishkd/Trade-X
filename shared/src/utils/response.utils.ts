import { ApiResponse, ApiError, Pagination, PaginatedResponse } from '../types/api.types';

export const successResponse = <T>(
  data: T,
  meta?: Record<string, unknown>,
): ApiResponse<T> => ({
  success: true,
  data,
  meta: { timestamp: new Date().toISOString(), ...meta },
});

export const errorResponse = (
  code: string,
  message: string,
  field?: string,
): ApiResponse => ({
  success: false,
  error: { code, message, field } as ApiError,
  meta: { timestamp: new Date().toISOString() },
});

export const paginatedResponse = <T>(
  data: T[],
  pagination: Pagination,
): PaginatedResponse<T> => ({
  success: true,
  data,
  pagination,
  meta: { timestamp: new Date().toISOString() },
});
