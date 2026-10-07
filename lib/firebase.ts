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
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
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
 * Subscribes to real-time visit changes in Firestore
 */
export function subscribeToVisits(callback: (visits: Visit[]) => void): () => void {
  const colRef = collection(db, 'visits');
  return onSnapshot(colRef, (snapshot) => {
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
    const q = query(collection(db, 'reports'), where('farm', '==', farmName));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as OnlineReportData);
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
