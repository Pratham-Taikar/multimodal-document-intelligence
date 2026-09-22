import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';

describe('App Scaffolding Render Test', () => {
  beforeEach(() => {
    // Mock global fetch for health check
    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            environment: 'development',
            version: '0.1.0',
            services: {
              api: { status: 'healthy' },
              database: {
                status: 'connected',
                latency_ms: 1.25,
                pgvector_installed: true,
                pgvector_version: '0.7.0',
                database: 'mdi_db',
              },
            },
          }),
      })
    );
  });

  it('renders the application shell with title and scaffolding header', async () => {
    render(<App />);

    // Check title in navigation bar
    expect(screen.getByText('Multimodal Document Intelligence')).toBeInTheDocument();

    // Check version pill
    expect(screen.getByText('v0.1.0-scaffolding')).toBeInTheDocument();

    // Check main dashboard heading
    expect(screen.getByText('System Scaffolding Status')).toBeInTheDocument();

    // Check database card
    expect(screen.getByText('PostgreSQL 16 + pgvector')).toBeInTheDocument();

    // Check footer
    expect(screen.getByText('Evidence-First Multimodal Document Intelligence Platform')).toBeInTheDocument();

    // Wait for the simulated fetch health call to resolve and update UI
    await waitFor(() => {
      expect(screen.getByText('Online')).toBeInTheDocument();
      expect(screen.getAllByText('Connected').length).toBeGreaterThanOrEqual(1);
    });
  });
});
