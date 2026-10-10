'use client';

import {lazy, Suspense, useEffect, useState} from 'react';
import {
  isFirebaseHostingHostname,
  isHostingPortalOnlyBuild
} from '@/lib/hosting-portal';

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
 * Firebase Hosting builds (`NEXT_PUBLIC_HOSTING_PORTAL_ONLY=1`) and the live
 * Hosting hostnames mount only the farm client portal.
 * Vinext / Sites / desktop keep the full technician workspace.
 */
export default function Home() {
  const portalOnlyBuild = isHostingPortalOnlyBuild();
  const [hostingHost, setHostingHost] = useState(false);

  useEffect(() => {
    setHostingHost(isFirebaseHostingHostname());
  }, []);

  if (portalOnlyBuild || hostingHost) {
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
