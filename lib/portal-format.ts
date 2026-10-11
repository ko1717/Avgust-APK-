/**
 * Farm-portal presentation helpers. Keep technician console copy elsewhere.
 */

/**
 * Client-facing criterion answer.
 * Technician inputs and the import matrix keep the short Sí / No.
 * SI, SÍ, NO and the long forms already stored in text all land here.
 */
export function complianceAnswerLabel(value?: string | null): string {
  const folded = String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (folded === 'si' || folded === 'si cumple' || folded === 'cumple' || folded === 'yes') {
    return 'Sí cumple';
  }
  if (folded === 'no' || folded === 'no cumple' || folded === 'incumple') {
    return 'No cumple';
  }
  if (folded === 'na' || folded === 'n/a' || folded === 'no aplica') {
    return 'No aplica';
  }
  return 'Sin evaluar';
}

/** Strip common markdown markers so clients never see raw `**` / `_` / backticks. */
export function stripMarkdownLite(input: string | null | undefined): string {
  if (!input) return '';
  let text = String(input);
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/\*([^*\n]+)\*/g, '$1');
  text = text.replace(/_([^_\n]+)_/g, '$1');
  text = text.replace(/`([^`]+)`/g, '$1');
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  text = text.replace(/^#{1,6}\s+/gm, '');
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  return text.replace(/\s+/g, ' ').trim();
}

export type PortalActionFields = {
  observation?: string | null;
  recommendation?: string | null;
  action: {
    owner?: string | null;
    due?: string | null;
    status?: string | null;
  };
};

const STATUS_LABELS: Record<string, string> = {
  proposed: 'Pendiente de formalizar',
  pending: 'Aceptada',
  progress: 'En proceso',
  closed: 'Completado',
  cancelled: 'Cancelado'
};

/** Client-facing labels and fallbacks for thin action / finding data. */
export function portalActionPresentation(problem: PortalActionFields) {
  const observation =
    stripMarkdownLite(problem.observation) ||
    'El técnico registró una desviación en este criterio. Abre el informe para ver el detalle de campo.';
  const recommendation =
    stripMarkdownLite(problem.recommendation) ||
    'Tu técnico AVGUST acordará contigo la acción correctiva en el seguimiento.';

  const ownerRaw = stripMarkdownLite(problem.action.owner);
  const dueRaw = (problem.action.due || '').trim();
  const statusKey = (problem.action.status || 'proposed').trim();
  const thin = statusKey === 'proposed' && !ownerRaw && !dueRaw;

  return {
    observation,
    recommendation,
    owner: ownerRaw || 'Pendiente de asignar con tu técnico AVGUST',
    due: dueRaw || 'Fecha por acordar',
    statusLabel: thin
      ? 'Pendiente de formalizar con el técnico'
      : STATUS_LABELS[statusKey] || statusKey,
    thin
  };
}
