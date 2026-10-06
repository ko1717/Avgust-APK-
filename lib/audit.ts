import {db} from './server';

type AuditValue=string|number|boolean|null;

/**
 * Persists a farm-scoped operational event.  `details` is intentionally
 * limited to non-sensitive metadata: never store invitation tokens, contact
 * details, visit payloads, photo bytes, or authentication headers here.
 */
export function audit(farmId:string,actorId:string,event:string,subjectType:string,subjectId:string,details:Record<string,AuditValue>={}){
 return db().prepare('INSERT INTO audit_events (id,farm_id,actor_id,event,subject_type,subject_id,details,created) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),farmId,actorId,event,subjectType,subjectId,JSON.stringify(details),new Date().toISOString());
}
