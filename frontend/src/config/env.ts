/**
 * Centralized application environment configuration.
 */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:8000';
