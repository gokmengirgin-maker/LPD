import React, { useState, useEffect } from 'react';
import './App.css';

const TARGET_HASH = '51828af52e25a8f749f0b845baff0be8c8f3a669d28a2aa9e94f03718ae59ecd'; // SHA-256 of 'lpd2026'
const STORAGE_KEY = 'tt_auth_v2'; // Changed key so old localStorage doesn't carry over

async function hashPassword(text) {
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function AuthGate({ children }) {
  // Always start unauthorized until we confirm from localStorage
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [checking, setChecking] = useState(true);

  // On mount, check localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === TARGET_HASH) {
      setIsAuthorized(true);
    }
    setChecking(false);
  }, []);

  // Block inspect / right-click
  useEffect(() => {
    const handleContextMenu = (e) => e.preventDefault();
    const handleKeyDown = (e) => {
      if (e.key === 'F12') e.preventDefault();
      if (e.ctrlKey && e.shiftKey && ['I','J','C','i','j','c'].includes(e.key)) e.preventDefault();
      if (e.ctrlKey && ['u','U'].includes(e.key)) e.preventDefault();
      if (e.ctrlKey && ['s','S'].includes(e.key)) e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSubmit = async () => {
    try {
      const hash = await hashPassword(passwordInput);
      if (hash === TARGET_HASH) {
        localStorage.setItem(STORAGE_KEY, TARGET_HASH);
        setIsAuthorized(true);
      } else {
        setAuthError('Hatalı şifre. Lütfen tekrar deneyin.');
        setPasswordInput('');
      }
    } catch {
      setAuthError('Şifre doğrulanamadı.');
    }
  };

  if (checking) return null; // Prevents flicker while reading localStorage

  if (!isAuthorized) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card">
          <div className="badge" style={{ marginBottom: '20px' }}>GÜVENLİ ERİŞİM</div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '8px' }}>Terratest Tool</h1>
          <p className="subtitle" style={{ fontSize: '0.9rem', marginBottom: '32px' }}>
            Bu uygulamaya erişmek için şifre girmeniz gerekmektedir.
          </p>

          <div className="field">
            <div className="input-wrapper" style={{ border: authError ? '1px solid #ef4444' : undefined }}>
              <input
                type="password"
                placeholder="Şifreyi girin..."
                value={passwordInput}
                autoFocus
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setAuthError('');
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                style={{ textAlign: 'center', letterSpacing: '0.12em' }}
              />
            </div>
            {authError && (
              <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '8px', textAlign: 'center' }}>
                {authError}
              </p>
            )}
          </div>

          <button className="action-btn" onClick={handleSubmit} style={{ marginTop: '24px' }}>
            GİRİŞ YAP
          </button>
        </div>
      </div>
    );
  }

  return children;
}
