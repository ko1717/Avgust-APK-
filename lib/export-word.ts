import {HeadingLevel, ImageRun, Packer, Paragraph, Table} from 'docx';
import {serviceLabels} from './team';
import {CHAPTER_WEIGHTS, measurementGroupsFor, metricStatus, metricStatusDescriptions, metricStatusLabels, metrics, ungroupedMeasurements, actionLabels, type Visit} from './model';
import {reportFindings, reportSections, type ReportSnapshot} from './reports';
import {nativeFiles, saveThroughBridge} from './native';
import template from './template.json';
import {complianceAnswerLabel} from './portal-format';
import {
  bodyParagraph,
  callout,
  coverPage,
  formatPercent,
  formatQuantity,
  labelValueTable,
  professionalTable,
  reportDocument,
  safeWordFilePart,
  sectionHeading,
  verticalSpace,
  CONTENT_WIDTH
} from './word-design';

export async function download(blob: Blob, name: string) {
  const bridge = nativeFiles();
  if (bridge) return saveThroughBridge(bridge, blob, name);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function serviceName(kind?: string) {
  if (!kind) return '';
  return kind in serviceLabels ? serviceLabels[kind as keyof typeof serviceLabels] : kind;
}

function spanishCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function chapterColumnWidths() {
  const columns = [2686, 1200, 860, 900, 1100, 1100];
  columns.push(CONTENT_WIDTH - columns.reduce((total, width) => total + width, 0));
  return columns;
}

function photoLine(photos: Visit['photos'], photoId: string, label: string) {
  if (!photoId) return '';
  const index = photos.findIndex(photo => photo.id === photoId);
  return `${label}: fotografía ${index + 1} del registro fotográfico.`;
}

export async function exportWord(v: Visit, snapshot?: ReportSnapshot) {
  const sections = snapshot?.sections || reportSections();
  const assessment = snapshot?.indicator || metrics(v);
  const service = serviceName(v.serviceKind);
  const findingsForVersion = reportFindings(v, sections);
  const groupedMeasurements = measurementGroupsFor(v.measurements);
  const unplacedGroups = groupedMeasurements.filter(group => !v.chapters.includes(Number(group.criterionId.split('.')[0])));
  const otherMeasurements = ungroupedMeasurements(v.measurements);
  const children: (Paragraph | Table)[] = [];
  const missingChapters = sections.filter(section => !v.chapters.includes(section.id));

  children.push(
    sectionHeading('Identificación de la visita'),
    bodyParagraph('Aseguramiento Aptus · AVGUST CARE 360. Los datos de esta sección identifican la visita y a las personas responsables.'),
    labelValueTable([
      ['Finca', v.farm || 'No registrado'],
      ['Fecha', v.date || 'No registrado'],
      ['Ciudad / departamento', v.city || 'No registrado'],
      ['Municipio / zona', v.zone || 'No registrado'],
      ['Representante de la finca', v.technician || 'No registrado'],
      ['Responsable AVGUST', v.responsible || 'No registrado'],
      ['Representante técnico comercial', v.rtc || 'No registrado'],
      ...(service ? [['Servicio', service] as [string, string]] : [])
    ]),
    sectionHeading('Marco del programa')
  );
  for (const block of template) {
    children.push(sectionHeading(block.title, HeadingLevel.HEADING_2));
    for (const paragraph of block.paragraphs) children.push(bodyParagraph(paragraph));
  }

  children.push(
    sectionHeading('Cronograma de actividades'),
    labelValueTable([
      ['Visita y aseguramiento', v.date || 'No registrado'],
      ['Entrega del informe', v.delivery || 'No programado'],
      ['Seguimiento', v.followup || 'No programado']
    ]),
    sectionHeading('Indicador del aseguramiento'),
    bodyParagraph(assessment.score === null
      ? 'Sin medición: no hay respuestas aplicables para calcular el indicador.'
      : `${metricStatusLabels[assessment.status]} · ${formatPercent(assessment.score)}. ${spanishCount(assessment.positive, 'respuesta “Sí cumple”', 'respuestas “Sí cumple”')} de ${spanishCount(assessment.applicable, 'criterio aplicable', 'criterios aplicables')}; ${spanishCount(assessment.findings, 'hallazgo', 'hallazgos')} por corregir.`),
    bodyParagraph(metricStatusDescriptions[assessment.status]),
    labelValueTable([
      ['Indicador de aseguramiento', assessment.score === null ? 'Sin medición' : `${formatPercent(assessment.score)} · ${metricStatusLabels[assessment.status]}`],
      ['Puntos oficiales', `${formatQuantity(assessment.pointsEarned)} / 100`],
      ['Cumplimiento de criterios', assessment.criteriaCompliance === null ? 'Sin medición' : `${formatPercent(assessment.criteriaCompliance)} · ${assessment.positive} “Sí cumple” de ${assessment.applicable} aplicables`],
      ['Alcance evaluado', `${assessment.evaluatedChapters.length} de 5 capítulos (${Math.round(assessment.auditedWeight * 100)}% del peso)`],
      ['Criterios respondidos', `${assessment.answered} de ${assessment.total}`],
      ['Hallazgos por corregir', String(assessment.findings)]
    ]),
    sectionHeading('Resultado por capítulo'),
    bodyParagraph('El porcentaje es el cumplimiento de los criterios aplicables de cada capítulo. El peso es la participación oficial de ese capítulo en el indicador.'),
    professionalTable([
      ['Capítulo', 'Indicador', 'Peso', 'Puntos', 'Hallazgos', 'Criterios', 'Estado'],
      ...sections.map(section => {
        const included = v.chapters.includes(section.id);
        const applicable = section.items.filter(item => ['SI', 'NO'].includes(v.answers[item.id]?.value || ''));
        const findingCount = applicable.filter(item => v.answers[item.id]?.value === 'NO').length;
        const score = included ? assessment.chapterScores[section.id] : null;
        const points = included ? assessment.chapterPoints[section.id] : null;
        return [
          `${section.id}. ${section.title}`,
          included ? formatPercent(score) : 'No incluido',
          `${Math.round((CHAPTER_WEIGHTS[section.id] || 0) * 100)}%`,
          included && points !== null && points !== undefined ? formatQuantity(points) : '—',
          included ? String(findingCount) : '—',
          included ? String(applicable.length) : '—',
          included ? metricStatusLabels[metricStatus(score)] : 'No incluido'
        ];
      })
    ], {
      compact: true,
      firstColumnBold: true,
      columnWidths: chapterColumnWidths()
    }),
    verticalSpace(80),
    bodyParagraph(`${assessment.answered} de ${assessment.total} ${assessment.total === 1 ? 'criterio respondido' : 'criterios respondidos'}. ${spanishCount(assessment.findings, 'respuesta “No cumple”', 'respuestas “No cumple”')} en los capítulos con cuestionario.`),
    bodyParagraph(`Capítulos no evaluados: ${missingChapters.map(section => `${section.id}. ${section.title}`).join('; ') || 'Ninguno'}.`),
    sectionHeading('Desarrollo de la evaluación')
  );

  for (const section of sections.filter(item => v.chapters.includes(item.id))) {
    const score = assessment.chapterScores[section.id];
    children.push(
      sectionHeading(`Capítulo ${section.id}. ${section.title}`),
      bodyParagraph(`Indicador ${formatPercent(score)} · ${metricStatusLabels[metricStatus(score)]} · peso ${Math.round((CHAPTER_WEIGHTS[section.id] || 0) * 100)}% · ${formatQuantity(assessment.chapterPoints[section.id] || 0)} puntos.`, {bold: true, color: '263E4A', keepNext: true})
    );
    for (const item of section.items) {
      const answer = v.answers[item.id];
      children.push(
        sectionHeading(`${item.id} · ${complianceAnswerLabel(answer?.value)}`, HeadingLevel.HEADING_2),
        bodyParagraph(item.text, {keepNext: Boolean(answer?.observation || answer?.recommendation)})
      );
      if (answer?.observation) {
        children.push(callout('Hallazgo', answer.observation, 'finding'));
      }
      if (answer?.recommendation) {
        if (answer.observation) children.push(verticalSpace(100));
        children.push(callout('Recomendación', answer.recommendation, 'recommendation'));
      }
      if (answer?.observation || answer?.recommendation) children.push(verticalSpace(80));
      for (const group of groupedMeasurements.filter(entry => entry.criterionId === item.id)) {
        children.push(
          sectionHeading(group.title, HeadingLevel.HEADING_2),
          labelValueTable(group.rows.map(row => [row.label, row.value])),
          verticalSpace(80)
        );
      }
    }
    if (v.notes[section.id]) {
      children.push(callout('Observaciones del capítulo', v.notes[section.id], 'finding'), verticalSpace(100));
    }
    if (v.recommendations[section.id]) {
      children.push(callout('Recomendaciones del capítulo', v.recommendations[section.id], 'recommendation'), verticalSpace(100));
    }
  }

  if (unplacedGroups.length || otherMeasurements.length) {
    children.push(sectionHeading('Mediciones de capítulos no evaluados'));
    for (const group of unplacedGroups) {
      children.push(
        sectionHeading(group.title, HeadingLevel.HEADING_2),
        labelValueTable(group.rows.map(row => [row.label, row.value])),
        verticalSpace(80)
      );
    }
    if (otherMeasurements.length) {
      children.push(labelValueTable(otherMeasurements.map(row => [row.label, row.value])));
    }
  }

  if (v.conclusion?.trim()) {
    children.push(sectionHeading('Conclusiones y seguimiento'), bodyParagraph(v.conclusion));
  }

  children.push(sectionHeading('Plan de acción'));
  if (findingsForVersion.length) {
    for (const finding of findingsForVersion) {
      const action = finding.action || {owner: '', due: '', status: 'proposed' as const, closure: '', photoId: '', beforePhotoId: ''};
      const evidence = [
        photoLine(v.photos, action.beforePhotoId || '', 'Evidencia inicial'),
        photoLine(v.photos, action.photoId || '', 'Evidencia de cierre')
      ].filter(Boolean);
      children.push(
        sectionHeading(`Hallazgo ${finding.id} · ${actionLabels[action.status] || action.status}`, HeadingLevel.HEADING_2),
        bodyParagraph(finding.text, {bold: true, color: '263E4A', keepNext: true}),
        callout('Hallazgo', finding.answer?.observation || 'Sin observación registrada en este informe.', 'finding'),
        verticalSpace(100),
        callout('Recomendación', finding.answer?.recommendation || 'Sin registrar', 'recommendation'),
        verticalSpace(100),
        labelValueTable([
          ['Responsable', action.owner || 'Sin asignar'],
          ['Fecha límite', action.due || 'Sin fecha'],
          ['Estado', actionLabels[action.status] || action.status],
          ['Seguimiento / cierre', action.closure || 'Pendiente'],
          ...(evidence.length ? [['Evidencia', evidence.join(' ')] as [string, string]] : [])
        ]),
        verticalSpace(80)
      );
    }
  } else {
    children.push(bodyParagraph('No hay hallazgos en los capítulos evaluados.'));
  }

  children.push(sectionHeading('Registro fotográfico'));
  if (!v.photos.length) children.push(bodyParagraph('No se adjuntaron fotografías.'));
  for (const [index, photo] of v.photos.entries()) {
    const response = await fetch(`/api/photos/${photo.id}`);
    if (!response.ok) throw new Error('No se pudo cargar una fotografía. No se generó el Word.');
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(530 / bitmap.width, 390 / bitmap.height, 1);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo preparar la imagen.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const jpg = await new Promise<Blob>((resolve, reject) => canvas.toBlob(file => file ? resolve(file) : reject(new Error('No se pudo preparar la imagen.')), 'image/jpeg', 0.9));
    children.push(new Paragraph({
      children: [new ImageRun({type: 'jpg', data: new Uint8Array(await jpg.arrayBuffer()), transformation: {width, height}})],
      keepNext: true
    }));
    children.push(bodyParagraph(`Fotografía ${index + 1} · Capítulo ${photo.chapter}${photo.criterionId ? ` · Subcapítulo ${photo.criterionId}` : ''}. ${photo.caption || 'Sin descripción'}`));
  }

  children.push(
    sectionHeading('Responsables'),
    bodyParagraph(`${v.responsible || 'Pendiente'} · AVGUST`),
    ...(v.rtc ? [bodyParagraph(`${v.rtc} · Representante técnico comercial`)] : []),
    bodyParagraph(`${v.technician || 'Pendiente'} · Representante de la finca`)
  );

  const doc = reportDocument({
    title: `Informe de visita · ${v.farm || 'Finca'}`,
    description: 'Informe técnico de visita del programa de aseguramiento Aptus',
    reportLabel: 'Informe de visita',
    detail: v.farm,
    cover: coverPage({
      label: 'Informe técnico de visita',
      title: v.farm || 'Finca sin nombre',
      subtitle: 'Aseguramiento Aptus · AVGUST CARE 360',
      notice: v.reviewed
        ? {label: 'Estado del documento', text: 'Revisado por el responsable técnico', tone: 'recommendation'}
        : {label: 'Estado del documento', text: 'Borrador · Pendiente de revisión técnica', tone: 'finding'},
      meta: [
        ['Fecha de la visita', v.date || 'No registrado'],
        ['Ciudad / departamento', v.city || 'No registrado'],
        ['Municipio / zona', v.zone || 'No registrado'],
        ['Responsable AVGUST', v.responsible || 'No registrado'],
        ...(service ? [['Servicio', service] as [string, string]] : [])
      ],
      score: assessment.score === null ? '—' : formatPercent(assessment.score),
      status: metricStatusLabels[assessment.status],
      statusKey: assessment.status
    }),
    body: children
  });
  await download(
    await Packer.toBlob(doc),
    `AVGUST CARE 360 - Informe de visita - ${safeWordFilePart(v.farm || 'Finca')} - ${safeWordFilePart(v.date || 'sin-fecha')}.docx`
  );
}
