/**
 * Centralized application environment configuration.
 *
 * `VITE_API_BASE_URL` is optional. When empty (the default), API calls use
 * same-origin relative URLs, and the Vite dev server proxies them to the
 * FastAPI backend (see `VITE_API_PROXY_TARGET` in vite.config.ts). Set an
 * absolute URL only when the frontend is served from a different origin than
 * the API (e.g. static hosting in front of a deployed backend).
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL?.trim() ?? '';
