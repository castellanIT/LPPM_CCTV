import React, { useState, useEffect, useCallback, useRef } from 'react';
import { login, fetchCameras } from './api';
import CameraTile from './components/CameraTile';
import './App.css';

const GRID_SIZES = [2, 3, 4, 6];

// ─── Read credentials from Amplify environment variables ───────────────────
const SERVER_ADDRESS = process.env.REACT_APP_DW_SERVER_ADDRESS || '';
const USERNAME       = process.env.REACT_APP_DW_USERNAME       || '';
const PASSWORD       = process.env.REACT_APP_DW_PASSWORD       || '';

// Re-authenticate every 50 minutes (auth keys expire after ~60 min)
const REAUTH_INTERVAL_MS = 50 * 60 * 1000;

export default function App() {
  const [session, setSession] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [status, setStatus]   = useState('connecting'); // connecting | ready | error
  const [error, setError]     = useState('');
  const [cols, setCols]       = useState(3);
  const [search, setSearch]   = useState('');
  const reauthTimer           = useRef(null);

  // ── Connect: authenticate + fetch camera list ────────────────────────────
  const connect = useCallback(async () => {
    setStatus('connecting');
    setError('');

    if (!SERVER_ADDRESS || !USERNAME || !PASSWORD) {
      setStatus('error');
      setError(
        'Environment variables not configured. ' +
        'Set REACT_APP_DW_SERVER_ADDRESS, REACT_APP_DW_USERNAME, ' +
        'and REACT_APP_DW_PASSWORD in the Amplify Console → Environment Variables.'
      );
      return;
    }

    try {
      const sess = await login(SERVER_ADDRESS, USERNAME, PASSWORD);
      const cams = await fetchCameras(sess.serverAddress, sess.authKey);
      setSession(sess);
      setCameras(cams);
      setStatus('ready');

      // Schedule silent re-authentication before key expires
      clearTimeout(reauthTimer.current);
      reauthTimer.current = setTimeout(connect, REAUTH_INTERVAL_MS);
    } catch (err) {
      setStatus('error');
      setError(err.message || 'Connection failed');

      // Auto-retry after 30 s on failure
      clearTimeout(reauthTimer.current);
      reauthTimer.current = setTimeout(connect, 30_000);
    }
  }, []);

  // ── Auto-connect on mount ────────────────────────────────────────────────
  useEffect(() => {
    connect();
    return () => clearTimeout(reauthTimer.current);
  }, [connect]);

  const filtered     = cameras.filter(c =>
    (c.name || '').toLowerCase().includes(search.toLowerCase())
  );
  const liveCount    = cameras.filter(c => c.status === 'Online' || c.status === 'Recording').length;
  const offlineCount = cameras.length - liveCount;

  // ── Connecting / Error splash ────────────────────────────────────────────
  if (status !== 'ready') {
    return (
      <div className="splash">
        <div className="splash-bg" />
        <div className="splash-card">
          <span className="logo-icon lg">⬡</span>
          <div className="logo-title">DW SPECTRUM</div>
          <div className="logo-sub">SURVEILLANCE DASHBOARD</div>

          {status === 'connecting' && (
            <div className="splash-status connecting">
              <span className="splash-spinner" />
              <span>Connecting to system…</span>
            </div>
          )}

          {status === 'error' && (
            <div className="splash-status error">
              <span className="splash-icon">⚠</span>
              <span>{error}</span>
              <button className="retry-btn" onClick={connect}>RETRY NOW</button>
              <span className="retry-note">Auto-retrying in 30 seconds…</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Dashboard ────────────────────────────────────────────────────────────
  return (
    <div className="dashboard">
      <header className="topbar">
        <div className="topbar-left">
          <span className="logo-icon sm">⬡</span>
          <span className="topbar-title">DW SPECTRUM</span>
          <span className="topbar-divider" />
          <span className="topbar-sub">{session.serverAddress}</span>
        </div>

        <div className="topbar-stats">
          <span className="stat live">{liveCount} ONLINE</span>
          <span className="stat">{offlineCount} OFFLINE</span>
          <span className="stat total">{cameras.length} TOTAL</span>
        </div>

        <div className="topbar-right">
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input
              className="search-input"
              type="text"
              placeholder="Search cameras…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="grid-size-picker">
            {GRID_SIZES.map(n => (
              <button
                key={n}
                className={`grid-btn ${cols === n ? 'active' : ''}`}
                onClick={() => setCols(n)}
                title={`${n} columns`}
              >
                {n}
              </button>
            ))}
          </div>

          <button className="icon-btn" onClick={connect} title="Refresh cameras">
            ↺
          </button>
        </div>
      </header>

      <main className="grid" style={{ '--cols': cols }}>
        {filtered.length === 0 && (
          <div className="empty-state">
            <span>⊡</span>
            <p>No cameras found{search ? ` matching "${search}"` : ''}</p>
          </div>
        )}
        {filtered.map(camera => (
          <CameraTile
            key={camera.id}
            camera={camera}
            serverAddress={session.serverAddress}
            authKey={session.authKey}
          />
        ))}
      </main>
    </div>
  );
}
