'use client';

import {lazy, Suspense, useEffect, useState} from 'react';
import {ensurePortalQueryOnHosting} from '@/lib/hosting-portal';

const FarmPortalView = lazy(() =>
  import('./farm-portal-view').then(module => ({default: module.FarmPortalView}))
);
const StandaloneOnlineReport = lazy(() =>
  import('./online-report-view').then(module => ({default: module.StandaloneOnlineReport}))
);

function PortalBoot() {
  return (
    <div
      className="fp-loading"
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#005f7a',
        color: '#fff',
        fontFamily: 'Manrope, Segoe UI, sans-serif'
      }}
    >
      <p>Cargando Portal de Finca…</p>
    </div>
  );
}

/**
 * Firebase Hosting entry: farm client portal only.
 * Does not mount the technician workspace / CARE 360 console.
 */
export default function FarmPortalHost() {
  const [ready, setReady] = useState(false);
  const [portalToken, setPortalToken] = useState<string | undefined>();
  const [onlineReportId, setOnlineReportId] = useState<string | null>(null);

  useEffect(() => {
    ensurePortalQueryOnHosting();
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'online-report' && params.get('id')) {
      setOnlineReportId(params.get('id'));
    }
    const inv =
      params.get('invitation') || params.get('codigo') || params.get('token') || '';
    setPortalToken(inv || undefined);
    setReady(true);
  }, []);

  if (!ready) return <PortalBoot />;

  if (onlineReportId) {
    return (
      <Suspense fallback={<PortalBoot />}>
        <StandaloneOnlineReport
          reportId={onlineReportId}
          onClose={() => {
            const params = new URLSearchParams(window.location.search);
            params.delete('view');
            params.delete('id');
            params.set('portal', 'finca');
            const q = params.toString();
            window.history.replaceState({}, '', `/${q ? `?${q}` : '?portal=finca'}`);
            setOnlineReportId(null);
          }}
        />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<PortalBoot />}>
      <FarmPortalView
        initialToken={portalToken}
        visits={[]}
        portalOnly
        onExitPortal={() => {
          // Hosting has no technician console — stay on the invitation gate.
          ensurePortalQueryOnHosting();
        }}
      />
    </Suspense>
  );
}
