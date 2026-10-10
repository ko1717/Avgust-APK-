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
  onSnapshot
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
};

/**
 * Publishes or updates an assurance report in cloud Firestore
 */
export async function publishOnlineReport(visit: Visit, authorEmail?: string): Promise<{url: string; id: string}> {
  const m = metrics(visit);
  const path = `reports/${visit.id}`;
  const reportDoc = doc(db, 'reports', visit.id);
  
  const data: OnlineReportData = {
    id: visit.id,
    farm: visit.farm || 'Finca sin nombre',
    farmId: visit.farmId,
    date: visit.date,
    city: visit.city,
    zone: visit.zone,
    technician: visit.technician,
    responsible: visit.responsible,
    rtc: visit.rtc,
    score: m.score,
    status: m.status,
    findingsCount: m.findings,
    applicableCount: m.applicable,
    reviewed: visit.reviewed,
    serviceKind: visit.serviceKind || 'assurance',
    chapters: visit.chapters,
    conclusion: visit.conclusion,
    publishedAt: new Date().toISOString(),
    publishedBy: authorEmail || auth.currentUser?.email || 'AVGUST Técnico',
    payload: visit
  };

  try {
    await setDoc(reportDoc, data, {merge: true});
    // Mirror the reviewed visit so the farm portal can list status in real time
    await setDoc(doc(db, 'visits', visit.id), {
      ...visit,
      syncTimestamp: new Date().toISOString(),
      updatedBy: authorEmail || auth.currentUser?.email || 'offline',
      publishedOnline: true
    }, {merge: true});
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }

  const origin = getPortalOrigin();
  const url = `${origin}?view=online-report&id=${encodeURIComponent(visit.id)}`;

  return {url, id: visit.id};
}

/**
 * Saves or updates a visit document in Firestore in real-time
 */
export async function saveVisitRealtime(visit: Visit): Promise<void> {
  const path = `visits/${visit.id}`;
  const visitDoc = doc(db, 'visits', visit.id);
  const data = {
    ...visit,
    syncTimestamp: new Date().toISOString(),
    updatedBy: auth.currentUser?.email || 'offline'
  };

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
  const q = query(collection(db, 'visits'), where('farm', '==', farmName), limit(100));
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
    console.error('Error in farm visits subscription:', error);
    callback([]);
  });
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
    const q = query(collection(db, 'reports'), where('farm', '==', farmName), limit(100));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as OnlineReportData);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Loads reviewed visits for a farm from Firestore (visits + published reports).
 */
export async function listFarmCloudVisits(farmName: string): Promise<Visit[]> {
  const byId = new Map<string, Visit>();
  try {
    const visitsQuery = query(collection(db, 'visits'), where('farm', '==', farmName), limit(100));
    const visitSnap = await getDocs(visitsQuery);
    visitSnap.forEach(docSnap => {
      const data = docSnap.data() as Visit;
      if (data?.id && data.farm) byId.set(data.id, data);
    });
  } catch (error) {
    console.warn('Could not list farm visits from Firestore:', error);
  }

  try {
    const reports = await listFarmOnlineReports(farmName);
    for (const report of reports) {
      const payload = report.payload;
      if (payload?.id && payload.farm) {
        byId.set(payload.id, {...byId.get(payload.id), ...payload, reviewed: payload.reviewed ?? report.reviewed});
      }
    }
  } catch (error) {
    console.warn('Could not list farm reports from Firestore:', error);
  }

  return Array.from(byId.values()).sort((a, b) => a.date.localeCompare(b.date));
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
