import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export const NotFound: React.FC = () => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4rem 1rem',
      textAlign: 'center',
    }}>
      <AlertCircle size={48} color="#f59e0b" style={{ marginBottom: '1rem' }} />
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 0.5rem 0', color: '#f8fafc' }}>
        404 - Page Not Found
      </h1>
      <p style={{ color: '#94a3b8', maxWidth: '400px', margin: '0 0 1.5rem 0' }}>
        The requested view does not exist in the current application scaffolding.
      </p>
      <Link
        to="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1rem',
          backgroundColor: '#1e293b',
          color: '#f8fafc',
          textDecoration: 'none',
          borderRadius: '6px',
          fontSize: '0.875rem',
          fontWeight: 500,
        }}
      >
        <ArrowLeft size={16} /> Return to Dashboard
      </Link>
    </div>
  );
};
