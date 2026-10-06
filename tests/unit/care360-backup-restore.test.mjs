import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, mkdir } from 'node:fs/promises';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../../', import.meta.url));

async function getWasmBinary() {
  const wasmPath = path.join(root, 'node_modules/sql.js/dist/sql-wasm.wasm');
  return readFile(wasmPath);
}

test('care360 backup and restore round-trip preserves all entities and photo blobs', async () => {
  await mkdir(path.join(root, 'work'), { recursive: true });
  await build({
    entryPoints: [path.join(root, 'lib/account-backup-file.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: path.join(root, 'work/account-backup-file.js'),
    external: ['sql.js']
  });

  const { createCare360Backup, readCare360Backup } = await import('../../work/account-backup-file.js');
  const samplePhotoBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);

  const bundle = {
    format: 'avgust-care-360-account-backup',
    version: 1,
    accountId: 'user-pilot-001',
    createdAt: new Date().toISOString(),
    farms: [
      {
        id: 'farm-001',
        name: 'Finca Flores de la Sabana',
        zone: 'Madrid / Cundinamarca',
        contact: 'Carlos Agrónomo',
        role: 'admin',
        contacts: [
          { id: 'c-1', name: 'Carlos Agrónomo', role: 'Ingeniero MIPE', phone: '3101234567', email: 'carlos@flores.com', receiveReports: true }
        ]
      }
    ],
    visits: [
      {
        id: 'visit-001',
        revision: 1,
        farmId: 'farm-001',
        farm: 'Finca Flores de la Sabana',
        date: '2026-09-15',
        city: 'Madrid',
        zone: 'Cundinamarca',
        technician: 'Carlos Agrónomo',
        responsible: 'Wilson Castro',
        rtc: 'RTC Sabana',
        chapters: [1, 2, 3, 4, 5],
        answers: {
          '1.1': { value: 'SI', observation: '', recommendation: '' },
          '2.1': { value: 'NO', observation: 'Falta calibración', recommendation: 'Calibrar balanza' }
        },
        notes: {},
        recommendations: {},
        measurements: { ph: '5.8', hardness: '45' },
        delivery: '2026-09-16',
        followup: '2026-09-30',
        conclusion: 'Auditoría MIPE completada',
        photos: [
          { id: 'photo-001', caption: 'Balanza descalibrada', chapter: 2, criterionId: '2.1' }
        ],
        reviewed: true
      }
    ],
    requests: [
      {
        id: 'req-001',
        farmId: 'farm-001',
        requestedByUserId: 'user-pilot-001',
        requestedByEmail: 'carlos@flores.com',
        serviceKind: 'assurance',
        topic: 'Aseguramiento MIPE trimestral',
        serviceDate: '2026-09-15',
        status: 'completed',
        created: '2026-09-01T10:00:00Z',
        updated: '2026-09-15T18:00:00Z'
      }
    ],
    reports: [
      {
        id: 'rep-001',
        farm_id: 'farm-001',
        visit_id: 'visit-001',
        version_number: 1,
        status: 'official',
        created_by: 'Wilson Castro',
        created_at: '2026-09-15T18:00:00Z',
        updated_at: '2026-09-15T18:00:00Z'
      }
    ],
    photos: [
      {
        id: 'photo-001',
        farmId: 'farm-001',
        mime: 'image/jpeg',
        data: Buffer.from(samplePhotoBytes).toString('base64')
      }
    ]
  };

  const locateFile = (file) => path.join(root, 'node_modules/sql.js/dist', file);
  // 1. Create backup (.care360 SQLite binary)
  const backupBytes = await createCare360Backup(bundle, locateFile);
  assert.ok(backupBytes instanceof Uint8Array);
  assert.ok(backupBytes.length > 500);

  // Verify SQLite format 3 magic header
  const header = new TextDecoder().decode(backupBytes.subarray(0, 16));
  assert.equal(header, 'SQLite format 3\u0000');

  // 2. Read backup as another user
  const imported = await readCare360Backup(backupBytes, 'user-pilot-002', locateFile);
  assert.equal(imported.bundle.format, 'avgust-care-360-account-backup');
  assert.equal(imported.bundle.farms.length, 1);
  assert.equal(imported.bundle.farms[0].name, 'Finca Flores de la Sabana');
  assert.equal(imported.bundle.farms[0].contacts.length, 1);
  assert.equal(imported.bundle.visits.length, 1);
  assert.equal(imported.bundle.visits[0].id, 'visit-001');
  assert.equal(imported.bundle.requests.length, 1);
  assert.equal(imported.bundle.reports.length, 1);
  assert.equal(imported.bundle.photos.length, 1);
  assert.equal(imported.bundle.photos[0].id, 'photo-001');
  assert.equal(imported.bundle.photos[0].data, Buffer.from(samplePhotoBytes).toString('base64'));
});
