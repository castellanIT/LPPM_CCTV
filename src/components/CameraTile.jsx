import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { getStreamUrl } from '../api';
import './CameraTile.css';

const STATUS = { LOADING: 'loading', LIVE: 'live', ERROR: 'error', OFFLINE: 'offline' };

export default function CameraTile({ camera, serverAddress, authKey }) {
  const videoRef   = useRef(null);
  const hlsRef     = useRef(null);
  const [status, setStatus] = useState(STATUS.LOADING);
  const [errMsg, setErrMsg] = useState('');

  const name     = camera.name || camera.id || 'Camera';
  const cameraId = camera.id;
  const isOnline = camera.status === 'Online' || camera.status === 'Recording';

  useEffect(() => {
    if (!isOnline) { setStatus(STATUS.OFFLINE); return; }

    const video   = videoRef.current;
    const src     = getStreamUrl(serverAddress, cameraId, authKey);

    function destroyHls() {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    }

    if (Hls.isSupported()) {
      destroyHls();
      const hls = new Hls({ enableWorker: false });
      hlsRef.current = hls;

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setStatus(STATUS.LIVE);
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          setStatus(STATUS.ERROR);
          setErrMsg(data.details || 'Stream error');
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.addEventListener('loadedmetadata', () => {
        setStatus(STATUS.LIVE);
        video.play().catch(() => {});
      });
      video.addEventListener('error', () => {
        setStatus(STATUS.ERROR);
        setErrMsg('Playback failed');
      });
    } else {
      setStatus(STATUS.ERROR);
      setErrMsg('HLS not supported in this browser');
    }

    return destroyHls;
  }, [serverAddress, cameraId, authKey, isOnline]);

  const dot = {
    [STATUS.LIVE]:    'dot-live',
    [STATUS.LOADING]: 'dot-loading',
    [STATUS.ERROR]:   'dot-error',
    [STATUS.OFFLINE]: 'dot-offline',
  }[status];

  const label = {
    [STATUS.LIVE]:    'LIVE',
    [STATUS.LOADING]: 'CONNECTING',
    [STATUS.ERROR]:   'ERROR',
    [STATUS.OFFLINE]: 'OFFLINE',
  }[status];

  return (
    <div className={`tile tile--${status}`}>
      {/* Header bar */}
      <div className="tile-header">
        <span className="tile-name" title={name}>{name}</span>
        <span className={`tile-badge ${dot}`}>
          <span className="dot" />
          {label}
        </span>
      </div>

      {/* Video */}
      <div className="tile-video-wrap">
        <video
          ref={videoRef}
          muted
          playsInline
          className="tile-video"
          style={{ display: status === STATUS.LIVE ? 'block' : 'none' }}
        />

        {status !== STATUS.LIVE && (
          <div className="tile-overlay">
            {status === STATUS.LOADING && (
              <>
                <span className="spinner" />
                <span className="overlay-text">Connecting…</span>
              </>
            )}
            {status === STATUS.OFFLINE && (
              <>
                <span className="icon-offline">⏻</span>
                <span className="overlay-text">Camera Offline</span>
              </>
            )}
            {status === STATUS.ERROR && (
              <>
                <span className="icon-error">⚠</span>
                <span className="overlay-text">{errMsg || 'Stream unavailable'}</span>
              </>
            )}
          </div>
        )}

        {/* Scan-line effect */}
        <div className="scanlines" />

        {/* Corner brackets */}
        <div className="corner tl" /><div className="corner tr" />
        <div className="corner bl" /><div className="corner br" />
      </div>

      {/* Footer */}
      <div className="tile-footer">
        <span className="tile-id">{cameraId?.substring(1, 9).toUpperCase()}</span>
        <span className="tile-model">{camera.typeId?.split('.')?.[0] || 'CAM'}</span>
      </div>
    </div>
  );
}
