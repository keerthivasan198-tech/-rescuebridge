// ==============================================================
// Centralized API Service Helper
// Uses the live Render Backend (https://rescuebridge.onrender.com)
// No local backend required. Frontend needs NO .env file.
// ==============================================================

const RENDER_BACKEND_URL = 'https://rescuebridge.onrender.com';

const RAW_API_BASE = (import.meta.env.VITE_API_BASE_URL || RENDER_BACKEND_URL).trim();

/**
 * Normalized backend API base URL pointing to Render
 */
export const API_BASE_URL = RAW_API_BASE.replace(/\/+$/, '');

/**
 * Returns the full backend URL for any endpoint.
 * Example: apiUrl('/api/sheets/sync') -> https://rescuebridge.onrender.com/api/sheets/sync
 */
export function apiUrl(endpoint: string): string {
  const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${cleanPath}`;
}
