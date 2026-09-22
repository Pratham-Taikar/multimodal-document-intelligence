import React, { useEffect, useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { FileText, Database, Activity } from 'lucide-react';
import { fetchHealth, HealthResponse } from '../../services/api';

export const AppShell: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function checkStatus() {
      try {
        const data = await fetchHealth();
        if (isMounted) {
          setHealth(data);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setHealth(null);
          setLoading(false);
        }
      }
    }

    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const isDbConnected = health?.services?.database?.status === 'connected';
  const isPgVectorReady = health?.services?.database?.pgvector_installed === true;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#090d16', color: '#e2e8f0' }}>
      {/* Header / Navigation */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.875rem 1.5rem',
        borderBottom: '1px solid #1e293b',
        backgroundColor: '#0f172a'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            padding: '0.4rem',
            backgroundColor: '#3b82f6',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff'
          }}>
            <FileText size={18} />
          </div>
          <Link to="/" style={{ color: '#f8fafc', textDecoration: 'none', fontWeight: 600, fontSize: '1rem', letterSpacing: '-0.01em' }}>
            Multimodal Document Intelligence
          </Link>
          <span style={{ fontSize: '0.75rem', backgroundColor: '#1e293b', padding: '0.2rem 0.5rem', borderRadius: '4px', color: '#94a3b8' }}>
            v0.1.0-scaffolding
          </span>
        </div>

        {/* Connectivity Status Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem' }}>
          {/* API Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Activity size={14} color={health ? '#22c55e' : '#ef4444'} />
            <span style={{ color: '#cbd5e1' }}>API:</span>
            <span style={{ color: health ? '#22c55e' : '#ef4444', fontWeight: 500 }}>
              {loading ? 'Checking...' : health ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Database / pgvector Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Database size={14} color={isDbConnected ? '#22c55e' : '#f59e0b'} />
            <span style={{ color: '#cbd5e1' }}>PostgreSQL:</span>
            <span style={{ color: isDbConnected ? '#22c55e' : '#f59e0b', fontWeight: 500 }}>
              {loading ? '...' : isDbConnected ? 'Connected' : 'Offline'}
            </span>
            {isDbConnected && (
              <span style={{
                fontSize: '0.7rem',
                backgroundColor: isPgVectorReady ? '#064e3b' : '#78350f',
                color: isPgVectorReady ? '#6ee7b7' : '#fde68a',
                padding: '0.1rem 0.35rem',
                borderRadius: '3px'
              }}>
                {isPgVectorReady ? 'pgvector ready' : 'no pgvector'}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main style={{ flex: 1, padding: '1.5rem', maxWidth: '1200px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <Outlet context={{ health, loading }} />
      </main>

      {/* Footer */}
      <footer style={{
        padding: '1rem 1.5rem',
        borderTop: '1px solid #1e293b',
        fontSize: '0.75rem',
        color: '#64748b',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>Evidence-First Multimodal Document Intelligence Platform</span>
        <span>Branch: feat/scaffolding</span>
      </footer>
    </div>
  );
};
