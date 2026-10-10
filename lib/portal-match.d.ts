export const PORTAL_ORIGIN: string;

export function getPortalOrigin(): string;

export function canonicalFarmName(name: string): string;

export function farmKey(name: string): string;

export function sameFarm(a: string, b: string): boolean;

export function omitUndefined<T>(value: T): T;

export function stableVisitId(visit: {id?: string; farm?: string; date?: string} | null | undefined): string;

export function normalizeInvitationCode(input: string): string;

export function isInvitationCode(input: string): boolean;

export function formatInvitationCode(num: number): string;

export function generateInvitationCode(): string;

export function publishFailureMessage(error: unknown): string;
