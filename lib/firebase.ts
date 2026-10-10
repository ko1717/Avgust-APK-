import {initializeApp,getApps,getApp} from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocFromServer,
  collection,
  query,
  where,
  limit,
  getDocs,
  onSnapshot,
  writeBatch,
  type Query
} from 'firebase/firestore';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  type User
} from 'firebase/auth';
import {useState, useEffect} from 'react';
import firebaseConfig from '../firebase-applet-config.json';
import {metrics,type Visit} from './model';
import {getPortalOrigin} from './portal-origin';
import {
  canonicalFarmName,
  farmKey,
  publishFailureMessage,
  omitUndefined,
  sameFarm,
  stableVisitId
} from './portal-match.mjs';

export {publishFailureMessage};

// Initialize Firebase App instance
const app = getApps().length ? getApp() : initializeApp({
  projectId: firebaseConfig.projectId,
  appId: firebaseConfig.appId,
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId
});

// Initialize Firestore with configured databaseId
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

// Initialize Firebase Auth
export const auth = getAuth(app);

export const ADMIN_EMAIL = 'vixnine777@gmail.com';

// Operation Types as defined in Firebase Skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const currentUser = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo: currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email
      })) || []
    },
    operationType,
    path
  };
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection on boot as mandated by Firebase Skill
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

if(typeof window !== 'undefined') {
  void testConnection();
}

export type OnlineReportData = {
  id: string;
  farm: string;
  farmId?: string;
  date: string;
  city?: string;
  zone?: string;
  technician: string;
  responsible: string;
  rtc?: string;
  score: number | null;
  status: string;
  findingsCount: number;
  applicableCount: number;
  reviewed: boolean;
  serviceKind: string;
  chapters: number[];
  conclusion?: string;
  publishedAt: string;
  publishedBy?: string;
  payload: Visit;
  /** Normalized farm name so invitations match visits despite case or extra spaces. */
  farmKey?: string;
};

function farmNameVariants(farmName: string): string[] {
  return Array.from(new Set(
    [String(farmName || '').trim(), canonicalFarmName(farmName)].filter(name => name.length > 0)
  ));
}

function farmLookups(collectionName: string, farmName: string): {label: string; q: Query}[] {
  const key = farmKey(farmName);
  const lookups: {label: string; q: Query}[] = farmNameVariants(farmName).map(name => ({
    label: `farm:${name}`,
    q: query(collection(db, collectionName), where('farm', '==', name), limit(100))
  }));
  if (key) {
    lookups.push({
      label: `farmKey:${key}`,
      q: query(collection(db, collectionName), where('farmKey', '==', key), limit(100))
    });
  }
  // Legacy rows may lack farmKey and differ only by case or spaces.
  lookups.push({
    label: 'scan',
    q: query(collection(db, collectionName), limit(100))
  });
  return lookups;
}

async function collectByFarm<T>(
  collectionName: string,
  farmName: string,
  accept: (row: T) => boolean,
  idOf: (row: T) => string | undefined
): Promise<T[]> {
  const byId = new Map<string, T>();
  await Promise.all(farmLookups(collectionName, farmName).map(async ({q}) => {
    try {
      const snapshot = await getDocs(q);
      snapshot.forEach(docSnap => {
        const row = docSnap.data() as T;
        const id = idOf(row);
        if (!id || !accept(row)) return;
        const prev = byId.get(id);
        byId.set(id, prev ? {...prev, ...row} : row);
      });
    } catch (error) {
      console.warn(`Consulta de ${collectionName} no disponible:`, error);
    }
  }));
  return Array.from(byId.values());
}

/**
 * Publishes or updates an assurance report in cloud Firestore
 */
export async function publishOnlineReport(visit: Visit, authorEmail?: string): Promise<{url: string; id: string}> {
  const farm = canonicalFarmName(visit.farm);
  if (!farm) {
    throw new Error('No se pudo publicar el informe en el portal: falta el nombre de la finca. El informe no llegó a Firebase.');
  }
  if (!String(visit.date || '').trim()) {
    throw new Error('No se pudo publicar el informe en el portal: falta la fecha de la visita. El informe no llegó a Firebase.');
  }

  const id = stableVisitId(visit);
  const key = farmKey(farm);
  const published: Visit = {...visit, id, farm};
  const m = metrics(published);
  const author = authorEmail || auth.currentUser?.email || 'AVGUST Técnico';
  const publishedAt = new Date().toISOString();

  const data: OnlineReportData = {
    id,
    farm,
    farmKey: key,
    farmId: published.farmId,
    date: published.date,
    city: published.city,
    zone: published.zone,
    technician: published.technician,
    responsible: published.responsible,
    rtc: published.rtc,
    score: m.score,
    status: m.status,
    findingsCount: m.findings,
    applicableCount: m.applicable,
    reviewed: published.reviewed,
    serviceKind: published.serviceKind || 'assurance',
    chapters: published.chapters,
    conclusion: published.conclusion,
    publishedAt,
    publishedBy: author,
    payload: published
  };

  try {
    const batch = writeBatch(db);
    // Same document id on every republish: merge updates the portal row in place.
    batch.set(doc(db, 'reports', id), omitUndefined(data), {merge: true});
    batch.set(doc(db, 'visits', id), omitUndefined({
      ...published,
      farmKey: key,
      syncTimestamp: publishedAt,
      updatedBy: author,
      publishedOnline: true
    }), {merge: true});
    await batch.commit();
  } catch (error) {
    throw new Error(publishFailureMessage(error));
  }

  const origin = getPortalOrigin();
  const url = `${origin}?view=online-report&id=${encodeURIComponent(id)}`;
  return {url, id};
}

/**
 * Saves or updates a visit document in Firestore in real-time
 */
export async function saveVisitRealtime(visit: Visit): Promise<void> {
  const farm = canonicalFarmName(visit.farm);
  if (!farm) return;
  const id = stableVisitId(visit);
  const path = `visits/${id}`;
  const visitDoc = doc(db, 'visits', id);
  const data = omitUndefined({
    ...visit,
    id,
    farm,
    farmKey: farmKey(farm),
    syncTimestamp: new Date().toISOString(),
    updatedBy: auth.currentUser?.email || 'offline'
  });

  try {
    await setDoc(visitDoc, data, {merge: true});
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Subscribes to real-time visit changes in Firestore.
 * Uses limit(100) so Firestore rules allow anonymous/client portal reads.
 */
export function subscribeToVisits(callback: (visits: Visit[]) => void): () => void {
  const q = query(collection(db, 'visits'), limit(100));
  return onSnapshot(q, (snapshot) => {
    const list: Visit[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as Visit;
      if (data && data.id && data.farm) {
        list.push(data);
      }
    });
    callback(list);
  }, (error) => {
    console.error('Error in real-time visits subscription:', error);
  });
}

/**
 * Subscribes to visits for one farm (client portal / servidor en línea).
 */
export function subscribeToFarmVisits(farmName: string, callback: (visits: Visit[]) => void): () => void {
  const key = farmKey(farmName);
  if (!key) {
    callback([]);
    return () => {};
  }
  const buckets = new Map<string, Map<string, Visit>>();
  const lookups = farmLookups('visits', farmName);
  const emit = () => {
    const merged = new Map<string, Visit>();
    for (const bucket of buckets.values()) {
      for (const visit of bucket.values()) {
        if (!visit.id || !sameFarm(visit.farm, farmName)) continue;
        const prev = merged.get(visit.id);
        merged.set(visit.id, prev ? {...prev, ...visit, id: visit.id} : visit);
      }
    }
    callback(Array.from(merged.values()).sort((a, b) => (a.date || '').localeCompare(b.date || '')));
  };
  const unsubs = lookups.map(({label, q}) => onSnapshot(q, snapshot => {
    const map = new Map<string, Visit>();
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as Visit;
      if (data?.id && data.farm && sameFarm(data.farm, farmName)) map.set(data.id, data);
    });
    buckets.set(label, map);
    emit();
  }, error => {
    console.error('Error in farm visits subscription:', error);
    buckets.set(label, new Map());
    emit();
  }));
  return () => {
    for (const unsub of unsubs) unsub();
  };
}

let lastPortalAuthWarning: string | null = null;

/** Last Anonymous Auth warning for portal UI (null when sign-in succeeded). */
export function getLastPortalAuthWarning(): string | null {
  return lastPortalAuthWarning;
}

/**
 * Ensures a lightweight Firebase Auth session for portal clients.
 * Prefer Anonymous Auth in production (Firebase Console → Authentication).
 * Falls back to public Firestore list/get rules if Anonymous Auth is disabled.
 */
export async function ensurePortalAuth(): Promise<User | null> {
  if (auth.currentUser) {
    lastPortalAuthWarning = null;
    return auth.currentUser;
  }
  try {
    const result = await signInAnonymously(auth);
    lastPortalAuthWarning = null;
    return result.user;
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error
      ? String((error as {code?: string}).code || '')
      : '';
    if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
      lastPortalAuthWarning =
        'Auth anónimo desactivado en Firebase. Un administrador debe habilitar Authentication → Sign-in method → Anonymous. El portal puede seguir con reglas públicas de invitación.';
      console.error(
        '[CARE360 portal] Firebase Anonymous Auth is disabled. Enable Authentication → Sign-in method → Anonymous in project gen-lang-client-0175464290.'
      );
    } else if (code === 'auth/unauthorized-domain') {
      lastPortalAuthWarning =
        'Este dominio no está autorizado en Firebase Auth. Agrégalo en Authentication → Settings → Authorized domains (Hosting).';
      console.error(
        '[CARE360 portal] This Hosting domain is not authorized for Firebase Auth. Add it under Authentication → Settings → Authorized domains.'
      );
    } else {
      lastPortalAuthWarning =
        'No se pudo iniciar sesión anónima; se continúa con el flujo de código de invitación.';
      console.warn(
        '[CARE360 portal] Anonymous Auth unavailable; continuing with public Firestore rules (invitation-code flow):',
        error
      );
    }
    return null;
  }
}

/**
 * Retrieves a single online report by ID
 */
export async function getOnlineReport(id: string): Promise<OnlineReportData | null> {
  const path = `reports/${id}`;
  const reportRef = doc(db, 'reports', id);
  try {
    const snapshot = await getDoc(reportRef);
    if(!snapshot.exists()) return null;
    return snapshot.data() as OnlineReportData;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Queries online reports for a specific farm
 */
export async function listFarmOnlineReports(farmName: string): Promise<OnlineReportData[]> {
  const path = 'reports';
  try {
    const rows = await collectByFarm<OnlineReportData>(
      'reports',
      farmName,
      row => sameFarm(row.farm || '', farmName) || sameFarm(row.payload?.farm || '', farmName),
      row => row.id || row.payload?.id
    );
    return rows;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Loads reviewed visits for a farm from Firestore (visits + published reports).
 */
export async function listFarmCloudVisits(farmName: string): Promise<Visit[]> {
  const byId = new Map<string, Visit>();
  const absorb = (visit: Visit | undefined) => {
    if (!visit?.id || !visit.farm || !sameFarm(visit.farm, farmName)) return;
    const prev = byId.get(visit.id);
    byId.set(visit.id, prev ? {...prev, ...visit, id: visit.id} : visit);
  };
  try {
    const visits = await collectByFarm<Visit>(
      'visits',
      farmName,
      row => sameFarm(row.farm || '', farmName),
      row => row.id
    );
    visits.forEach(absorb);
  } catch (error) {
    console.warn('Could not list farm visits from Firestore:', error);
  }

  try {
    const reports = await listFarmOnlineReports(farmName);
    for (const report of reports) {
      const payload = report.payload;
      if (!payload?.id) continue;
      if (!sameFarm(payload.farm || '', farmName) && !sameFarm(report.farm || '', farmName)) continue;
      absorb({
        ...payload,
        id: payload.id,
        farm: canonicalFarmName(payload.farm || report.farm),
        reviewed: payload.reviewed ?? report.reviewed
      });
    }
  } catch (error) {
    console.warn('Could not list farm reports from Firestore:', error);
  }

  return Array.from(byId.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** Client-submitted request to schedule an assurance visit (farm portal). */
export type AssuranceRequest = {
  id: string;
  farm: string;
  farmId?: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  preferredDate?: string;
  notes?: string;
  status: 'pending' | 'scheduled' | 'cancelled' | 'done';
  source: 'farm-portal';
  invitationCode?: string;
  createdAt: string;
  farmKey?: string;
};

/**
 * Creates a pending assurance scheduling request from the farm portal.
 * Technicians can review these later in Firestore (`assuranceRequests`).
 */
export async function createAssuranceRequest(input: {
  farm: string;
  farmId?: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  preferredDate?: string;
  notes?: string;
  invitationCode?: string;
}): Promise<AssuranceRequest> {
  const id = `areq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `assuranceRequests/${id}`;
  const farm = canonicalFarmName(input.farm);
  const data: AssuranceRequest = {
    id,
    farm,
    farmId: input.farmId,
    clientName: input.clientName.trim() || 'Responsable de finca',
    clientPhone: input.clientPhone?.trim() || undefined,
    clientEmail: input.clientEmail?.trim() || undefined,
    preferredDate: input.preferredDate?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    status: 'pending',
    source: 'farm-portal',
    invitationCode: input.invitationCode,
    createdAt: new Date().toISOString(),
    farmKey: farmKey(farm)
  };
  try {
    await setDoc(doc(db, 'assuranceRequests', id), omitUndefined(data));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
  return data;
}

/** Lists recent assurance requests for one farm (portal + technician visibility). */
export async function listFarmAssuranceRequests(farmName: string): Promise<AssuranceRequest[]> {
  const path = 'assuranceRequests';
  try {
    const rows = await collectByFarm<AssuranceRequest>(
      'assuranceRequests',
      farmName,
      row => sameFarm(row.farm || '', farmName),
      row => row.id
    );
    return rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Custom React hook for Firebase Auth management
 */
export function useFirebaseAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  };

  const loginAnonymously = async () => {
    return signInAnonymously(auth);
  };

  const logout = async () => {
    return signOut(auth);
  };

  const isAdmin = user?.email === ADMIN_EMAIL;

  return {
    user,
    loading,
    loginWithGoogle,
    loginAnonymously,
    logout,
    isAdmin
  };
}
