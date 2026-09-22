import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { Layers, ShieldCheck, Database, Terminal } from 'lucide-react';
import { HealthResponse } from '../services/api';

interface ShellContext {
  health: HealthResponse | null;
  loading: boolean;
}

export const Dashboard: React.FC = () => {
  const { health, loading } = useOutletContext<ShellContext>();

  const dbInfo = health?.services?.database;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Overview Card */}
      <div style={{
        backgroundColor: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '8px',
        padding: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Layers size={20} color="#38bdf8" />
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc' }}>
            System Scaffolding Status
          </h1>
        </div>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.875rem' }}>
          Phase 1 Foundation: React + Vite frontend, FastAPI backend, PostgreSQL 16 with pgvector extension.
        </p>
      </div>

      {/* Services Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1rem',
      }}>
        {/* Backend Status Card */}
        <div style={{
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '8px',
          padding: '1.25rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Terminal size={18} color="#a855f7" />
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#f1f5f9' }}>FastAPI Backend</h2>
            </div>
            <span style={{
              fontSize: '0.75rem',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              backgroundColor: health ? '#052e16' : '#450a0a',
              color: health ? '#4ade80' : '#f87171',
              fontWeight: 500,
            }}>
              {loading ? 'Checking...' : health ? 'Running' : 'Unreachable'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Environment:</span>
              <span style={{ color: '#f1f5f9', fontFamily: 'monospace' }}>{health?.environment || 'N/A'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Version:</span>
              <span style={{ color: '#f1f5f9', fontFamily: 'monospace' }}>{health?.version || '0.1.0'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Endpoints:</span>
              <span style={{ color: '#38bdf8', fontFamily: 'monospace' }}>/api/v1/health</span>
            </div>
          </div>
        </div>

        {/* Database Status Card */}
        <div style={{
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '8px',
          padding: '1.25rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={18} color="#06b6d4" />
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#f1f5f9' }}>PostgreSQL 16 + pgvector</h2>
            </div>
            <span style={{
              fontSize: '0.75rem',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              backgroundColor: dbInfo?.status === 'connected' ? '#052e16' : '#450a0a',
              color: dbInfo?.status === 'connected' ? '#4ade80' : '#f87171',
              fontWeight: 500,
            }}>
              {loading ? '...' : dbInfo?.status === 'connected' ? 'Connected' : 'Offline'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Database Name:</span>
              <span style={{ color: '#f1f5f9', fontFamily: 'monospace' }}>{dbInfo?.database || 'mdi_db'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Query Latency:</span>
              <span style={{ color: '#f1f5f9', fontFamily: 'monospace' }}>
                {dbInfo?.latency_ms !== undefined ? `${dbInfo.latency_ms} ms` : 'N/A'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>pgvector Extension:</span>
              <span style={{
                color: dbInfo?.pgvector_installed ? '#4ade80' : '#f87171',
                fontFamily: 'monospace',
                fontWeight: 600
              }}>
                {dbInfo?.pgvector_installed ? `Installed (v${dbInfo.pgvector_version || '0.7.0'})` : 'Not Found'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Architecture Boundaries Checklist */}
      <div style={{
        backgroundColor: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '8px',
        padding: '1.25rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <ShieldCheck size={18} color="#22c55e" />
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#f1f5f9' }}>
            Infrastructure Simplicity Rules (Enforced)
          </h2>
        </div>

        <ul style={{
          margin: 0,
          paddingLeft: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          fontSize: '0.85rem',
          color: '#94a3b8',
        }}>
          <li>Single PostgreSQL 16 instance handles Relational, Dense Vector, and Lexical Full-Text Search.</li>
          <li>No external vector database container (No Qdrant).</li>
          <li>No graph database container (No Neo4j).</li>
          <li>No caching or message queue containers (No Redis, Celery, or RabbitMQ).</li>
          <li>No local heavyweight ML dependencies (No PyTorch or CUDA runtimes).</li>
        </ul>
      </div>
    </div>
  );
};
