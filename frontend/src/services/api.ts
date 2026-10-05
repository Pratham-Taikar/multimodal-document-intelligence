import { API_BASE_URL } from '../config/env';

export interface DatabaseHealth {
  status: string;
  latency_ms?: number;
  pgvector_installed?: boolean;
  pgvector_version?: string | null;
  database?: string;
  error?: string;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | string;
  timestamp: string;
  environment: string;
  version: string;
  services: {
    api: {
      status: string;
    };
    database: DatabaseHealth;
  };
}

/**
 * Fetches the health status of the backend API and its database.
 */
export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/health`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok && response.status !== 503) {
    throw new Error(`API health check failed with status: ${response.status}`);
  }

  return response.json();
}
