import type {MetricStatus} from './model';

export type DossierKind='visit'|'request'|'report'|'photo'|'followup';

export type DossierEvent={
 id:string;
 kind:DossierKind;
 occurredOn:string;
 visitId?:string;
 requestId?:string;
 reportVersionId?:string;
 title:string;
 description:string;
 score?:number|null;
 status?:MetricStatus;
};

export type FarmDossier={
 farm:{id:string;name:string;zone:string;contact:string};
 summary:{visits:number;reports:number;openRequests:number;pendingFollowups:number;overdueFollowups:number;recentCompletedFollowups:number;photos:number;latestVisit?:{id:string;date:string;responsible:string;score:number|null;status:MetricStatus}};
 events:DossierEvent[];
 nextCursor:string|null;
};
