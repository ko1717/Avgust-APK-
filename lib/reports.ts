import {catalog,metrics,type Visit} from './model';
import type {Role} from './team';

export type ReportStatus='draft'|'in_review'|'approved'|'published';
export const reportStatusLabels:Record<ReportStatus,string>={draft:'Borrador',in_review:'En revisión',approved:'Aprobado',published:'Publicado'};

export type SnapshotParticipant={name:string;role:Role};
export type ReportSection={id:number;title:string;items:{id:string;text:string}[]};
export type ReportContent=Omit<Visit,'id'|'revision'|'farmId'|'requestId'|'canEdit'>;
export type ReportSnapshot={
 schema:1;
 source:{visitId:string;visitRevision:number};
 farm:{name:string;city:string;zone:string;participants:SnapshotParticipant[]};
 content:ReportContent;
 sections:ReportSection[];
 indicator:ReturnType<typeof metrics>;
};

export type ReportVersion={
 id:string;farmId:string;visitId:string;versionNumber:number;status:ReportStatus;sourceVisitRevision:number;
 createdBy:string;createdAt:string;submittedBy?:string;submittedAt?:string;approvedBy?:string;approvedAt?:string;
 publishedBy?:string;publishedAt?:string;revision:number;updatedAt:string;snapshot?:ReportSnapshot;
};

export function reportSections():ReportSection[]{return catalog.map(chapter=>({id:chapter.id,title:chapter.title,items:chapter.items.map(item=>({id:item.id,text:item.text}))}));}

/** A report snapshot stores document text and photo references only; image bytes remain in R2/SQLite. */
export function makeReportSnapshot(visit:Visit,participants:SnapshotParticipant[]):ReportSnapshot{
 const {id,revision,farmId:_,requestId:__,canEdit:___,...content}=visit;
 return {schema:1,source:{visitId:id,visitRevision:revision},farm:{name:visit.farm,city:visit.city,zone:visit.zone,participants},content,sections:reportSections(),indicator:metrics(visit)};
}

export function snapshotToVisit(snapshot:ReportSnapshot):Visit{
 return {...snapshot.content,id:snapshot.source.visitId,revision:snapshot.source.visitRevision,canEdit:false};
}

export function reportFindings(visit:Visit,sections:ReportSection[]){
 return sections.filter(section=>visit.chapters.includes(section.id)).flatMap(section=>section.items).filter(item=>visit.answers[item.id]?.value==='NO').map(item=>({id:item.id,text:item.text,answer:visit.answers[item.id],action:visit.actions?.[item.id]}));
}

export function isReportStatus(value:unknown):value is ReportStatus{return value==='draft'||value==='in_review'||value==='approved'||value==='published';}
