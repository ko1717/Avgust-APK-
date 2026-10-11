'use client';

import {lazy, Suspense, type ComponentType} from 'react';

const FarmPortalHost = lazy(() => import('./farm-portal-host'));

/**
 * Hosting builds set NEXT_PUBLIC_HOSTING_PORTAL_ONLY=1 before Rollup runs, so
 * the technician import is dead code and the console chunk is not emitted.
 */
const TechnicianShell: ComponentType | null =
  process.env.NEXT_PUBLIC_HOSTING_PORTAL_ONLY === '1'
    ? null
    : lazy(() => import('./technician-shell'));

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
 * Firebase Hosting builds mount only the farm client portal.
 * Vinext / Sites / desktop keep the full CARE 360 technician shell.
 */
export default function Home() {
  if (process.env.NEXT_PUBLIC_HOSTING_PORTAL_ONLY === '1') {
    return (
      <Suspense fallback={<Boot label="Cargando Portal de Finca…" />}>
        <FarmPortalHost />
      </Suspense>
    );
  }

  if (!TechnicianShell) {
    return (
      <Suspense fallback={<Boot label="Cargando Portal de Finca…" />}>
        <FarmPortalHost />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<Boot label="Cargando AVGUST CARE 360…" />}>
      <TechnicianShell />
    </Suspense>
  );
}
