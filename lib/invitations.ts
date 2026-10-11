import {doc, setDoc, collection, getDocs, query, where, limit, updateDoc} from 'firebase/firestore';
import {db, auth} from './firebase';
import {buildHostingPortalUrl, getPortalOrigin} from './portal-origin';
import {
  canonicalFarmName,
  farmKey,
  generateInvitationCode,
  isInvitationCode,
  normalizeInvitationCode,
  omitUndefined
} from './portal-match.mjs';

export {getPortalOrigin} from './portal-origin';
export {generateInvitationCode, normalizeInvitationCode, isInvitationCode} from './portal-match.mjs';

export type FarmInvitation = {
  id: string;
  code: string;
  token: string;
  farm: string;
  farmId?: string;
  clientName: string;
  clientRole?: string;
  clientEmail?: string;
  clientPhone?: string;
  status: 'active' | 'revoked';
  createdAt: string;
  createdBy: string;
  expiresAt?: string;
  /** Normalized farm name. Older invitations (including ASEG-3601) may omit it. */
  farmKey?: string;
};

const LOCAL_STORAGE_KEY = 'care360:invitations';
const ACTIVE_SESSION_KEY = 'care360:client_session';

function getLocalInvitations(): FarmInvitation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalInvitations(list: FarmInvitation[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

/**
 * Generates a random secure token
 */
export function generateToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  }
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

/**
 * Creates a new invitation for a farm administrator / client
 */
export async function createFarmInvitation(input: {
  farm: string;
  farmId?: string;
  clientName: string;
  clientRole?: string;
  clientEmail?: string;
  clientPhone?: string;
  createdBy?: string;
}): Promise<FarmInvitation> {
  const farm = canonicalFarmName(input.farm);
  if (!farm) throw new Error('Escribe el nombre de la finca para emitir la invitación.');
  const code = generateInvitationCode();
  const token = generateToken();
  const id = `inv_${Date.now()}_${token.slice(0, 6)}`;
  const author = input.createdBy || auth.currentUser?.email || 'Técnico Agrícola AVGUST';

  const invitation: FarmInvitation = {
    id,
    code,
    token,
    farm,
    farmKey: farmKey(farm),
    farmId: input.farmId,
    clientName: input.clientName,
    clientRole: input.clientRole || 'Responsable de Finca',
    clientEmail: input.clientEmail,
    clientPhone: input.clientPhone,
    status: 'active',
    createdAt: new Date().toISOString(),
    createdBy: author
  };

  // 1. Save locally for instant availability
  const current = getLocalInvitations();
  saveLocalInvitations([invitation, ...current.filter(i => i.id !== id)]);

  // 2. Persist to Firestore
  try {
    const docRef = doc(db, 'invitations', id);
    await setDoc(docRef, omitUndefined(invitation), {merge: true});
  } catch (err) {
    console.warn('Could not persist invitation to Firestore, cached locally:', err);
  }

  return invitation;
}

/**
 * Verifies an invitation either by token (from URL) or by manual code (e.g. ASEG-1234).
 * Also accepts legacy MIPE-* codes already stored in Firebase.
 */
function invitationMatches(inv: FarmInvitation, trimmed: string, code: string): boolean {
  if (inv.status !== 'active') return false;
  if (isInvitationCode(code) && normalizeInvitationCode(inv.code || '') === code) return true;
  const token = inv.token || '';
  return token === trimmed || token.toLowerCase() === trimmed.toLowerCase();
}

export async function verifyFarmInvitation(tokenOrCode: string): Promise<FarmInvitation | null> {
  const trimmed = tokenOrCode.trim();
  if (!trimmed) return null;
  const code = normalizeInvitationCode(trimmed);

  // 1. Check local cache first. Does not rewrite stored invitations such as ASEG-3601.
  const localList = getLocalInvitations();
  const foundLocal = localList.find(inv => invitationMatches(inv, trimmed, code));
  if (foundLocal) return foundLocal;

  // 2. Query Firestore by normalized ASEG/MIPE code, then by token.
  try {
    const colRef = collection(db, 'invitations');
    const codeLookups = new Set<string>();
    if (isInvitationCode(code)) codeLookups.add(code);
    const upper = trimmed.toUpperCase();
    if (upper !== code && isInvitationCode(upper)) codeLookups.add(normalizeInvitationCode(upper));
    if (isInvitationCode(trimmed)) codeLookups.add(normalizeInvitationCode(trimmed));

    for (const candidate of codeLookups) {
      const snapCode = await getDocs(query(colRef, where('code', '==', candidate), limit(5)));
      if (!snapCode.empty) {
        const inv = snapCode.docs[0].data() as FarmInvitation;
        if (inv.status === 'active') {
          saveLocalInvitations([inv, ...localList.filter(i => i.id !== inv.id)]);
          return inv;
        }
      }
    }

    const tokenLookups = new Set([trimmed, trimmed.toLowerCase()]);
    for (const token of tokenLookups) {
      const snapToken = await getDocs(query(colRef, where('token', '==', token), limit(5)));
      if (!snapToken.empty) {
        const inv = snapToken.docs[0].data() as FarmInvitation;
        if (inv.status === 'active') {
          saveLocalInvitations([inv, ...localList.filter(i => i.id !== inv.id)]);
          return inv;
        }
      }
    }
  } catch (err) {
    console.warn('Error verifying invitation against Firestore:', err);
  }

  return null;
}

/**
 * Lists all invitations generated by technicians
 */
export async function listFarmInvitations(): Promise<FarmInvitation[]> {
  const localList = getLocalInvitations();
  try {
    const colRef = collection(db, 'invitations');
    const snapshot = await getDocs(query(colRef, limit(100)));
    const cloudList: FarmInvitation[] = [];
    snapshot.forEach(d => {
      cloudList.push(d.data() as FarmInvitation);
    });
    // Merge cloud and local
    const map = new Map<string, FarmInvitation>();
    for (const inv of localList) map.set(inv.id, inv);
    for (const inv of cloudList) map.set(inv.id, inv);
    const merged = Array.from(map.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    saveLocalInvitations(merged);
    return merged;
  } catch {
    return localList;
  }
}

/**
 * Revokes an invitation immediately
 */
export async function revokeFarmInvitation(id: string): Promise<void> {
  const localList = getLocalInvitations();
  saveLocalInvitations(localList.map(i => (i.id === id ? {...i, status: 'revoked' as const} : i)));

  try {
    const docRef = doc(db, 'invitations', id);
    await updateDoc(docRef, {status: 'revoked'});
  } catch (err) {
    console.warn('Error revoking invitation in Firestore:', err);
  }
}

/**
 * Stores the authenticated farm manager session in local storage
 */
export function setClientSession(invitation: FarmInvitation): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(invitation));
  } catch {}
}

/**
 * Retrieves the current authenticated farm manager session
 */
export function getClientSession(): FarmInvitation | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Clears the active farm manager session
 */
export function clearClientSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch {}
}

/**
 * Builds the URL to access the farm portal with the invitation token
 */
export function buildInvitationPortalUrl(token: string): string {
  return buildHostingPortalUrl({invitation: token});
}

/**
 * Formats a ready-to-send WhatsApp invitation message
 */
export function buildWhatsAppInvitationMessage(invitation: FarmInvitation): string {
  const url = buildInvitationPortalUrl(invitation.token);
  return `*AVGUST CARE 360 · Portal de Finca · Aseguramiento*

Estimado(a) *${invitation.clientName}*,
El equipo técnico de AVGUST te ha habilitado acceso exclusivo al portal de aseguramiento para la finca *${invitation.farm}*.

🔑 *Código de aseguramiento:* ${invitation.code}
🔗 *Enlace directo:*
${url}

En este portal podrás:
• Consultar el semáforo y estatus oficial de aseguramiento (Saludable 95-100%, Alerta 80-94%, Vulnerable <80%)
• Ver la evolución de todas las visitas técnicas sin imprimir papel
• Revisar las recomendaciones y compromisos acordados
• Descargar los informes en Word o PDF

_AVGUST Crop Protection · Juntos Crecemos Bien_`;
}
