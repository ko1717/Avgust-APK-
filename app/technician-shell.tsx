'use client';

import {lazy, Suspense, useSyncExternalStore} from 'react';
import {isFirebaseHostingHostname} from '@/lib/hosting-portal';

const FarmPortalHost = lazy(() => import('./farm-portal-host'));
const Workspace = lazy(() => import('./workspace'));

function Boot({label}: {label: string}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#005f7a',
        color: '#fff',
        fontFamily: 'Manrope, Segoe UI, sans-serif'
      }}
    >
      <p>{label}</p>
    </div>
  );
}

/**
 * Full CARE 360 technician shell. The Firebase Hosting build does not import
 * this module, so the console chunk stays off the portal deploy.
 */
export default function TechnicianShell() {
  const hostingHost = useSyncExternalStore(
    () => () => {},
    () => isFirebaseHostingHostname(),
    () => false
  );

  if (hostingHost) {
    return (
      <Suspense fallback={<Boot label="Cargando Portal de Finca…" />}>
        <FarmPortalHost />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<Boot label="Cargando AVGUST CARE 360…" />}>
      <Workspace />
    </Suspense>
  );
}
