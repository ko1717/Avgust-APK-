import {blankAction,type Action,type ActionStatus} from './model';

export const COMMITMENT_DUE_SOON_DAYS=7;
export type CommitmentBucket='all'|'today'|'upcoming'|'overdue'|'completed';
export type CommitmentAudit={event:string;criterionId:string;details:Record<string,string|boolean>};

export function activeStatus(status:ActionStatus){return status==='pending'||status==='progress';}
export function actionFor(value:Partial<Action>|undefined):Action{return {...blankAction(),...value};}
export function completionDate(action:Action){return (action.completedAt||'').slice(0,10);}
export function isOverdue(action:Action,today:string){return activeStatus(action.status)&&Boolean(action.due)&&action.due<today;}
export function isDueToday(action:Action,today:string){return activeStatus(action.status)&&action.due===today;}
export function isUpcoming(action:Action,today:string,until:string){return activeStatus(action.status)&&Boolean(action.due)&&action.due>today&&action.due<=until;}

export function inBucket(action:Action,bucket:CommitmentBucket,today:string,until:string){
 if(bucket==='all')return true;
 if(bucket==='today')return isDueToday(action,today);
 if(bucket==='upcoming')return isUpcoming(action,today,until);
 if(bucket==='overdue')return isOverdue(action,today);
 return action.status==='closed';
}

/** Adds server-owned completion data and emits only non-sensitive audit metadata. */
export function transitionAction(previous:Partial<Action>|undefined,next:Action,actor:string,at:string,criterionId:string){
 const before=actionFor(previous),after={...next};const events:CommitmentAudit[]=[];
 if(after.status==='closed'&&before.status!=='closed'){
  after.completedAt=at;after.completedBy=actor;
  events.push({event:'commitment.completed',criterionId,details:{status:'closed'}});
 }else if(before.status==='closed'&&after.status!=='closed'){
  after.reopenedAt=at;
  events.push({event:'commitment.reopened',criterionId,details:{status:after.status}});
 }
 if(!previous&&after.status!=='proposed')events.push({event:'commitment.created',criterionId,details:{status:after.status}});
 if(previous&&before.owner!==after.owner)events.push({event:'commitment.assignee_changed',criterionId,details:{assigned:Boolean(after.owner)}});
 if(previous&&before.due!==after.due)events.push({event:'commitment.due_changed',criterionId,details:{hasDue:Boolean(after.due)}});
 if(previous&&before.status!==after.status&&after.status==='cancelled')events.push({event:'commitment.cancelled',criterionId,details:{status:'cancelled'}});
 if(previous&&before.status!==after.status&&after.status!=='closed'&&before.status!=='closed'&&after.status!=='cancelled')events.push({event:'commitment.status_changed',criterionId,details:{status:after.status}});
 return {action:after,events};
}
