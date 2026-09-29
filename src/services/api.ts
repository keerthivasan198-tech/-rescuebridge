// ==============================================================
// Centralized API Service Helper
// Strictly loads the backend URL from environment variables (.env)
// Never hardcodes URLs in source code (Security Checklist #1)
// ==============================================================

const RAW_API_BASE = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Normalized backend API base URL from .env
 */
export const API_BASE_URL = RAW_API_BASE.trim().replace(/\/+$/, '');

/**
 * Returns the full backend URL for any endpoint.
 * Example: apiUrl('/api/sheets/sync') -> https://rescuebridge.onrender.com/api/sheets/sync
 */
export function apiUrl(endpoint: string): string {
  const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return API_BASE_URL ? `${API_BASE_URL}${cleanPath}` : cleanPath;
}
