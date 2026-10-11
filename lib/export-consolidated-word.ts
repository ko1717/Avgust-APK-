import {HeadingLevel, Packer, Paragraph, Table} from 'docx';
import {download} from './export-word';
import {CHAPTER_WEIGHTS, actionLabels, findings, farmKey, metricStatusDescriptions, metricStatusLabels, metricTrendLabels} from './model';
import type {ConsolidatedMetricAnalysis} from './metric-analysis';
import {
  bodyParagraph,
  callout,
  coverPage,
  formatPercent,
  labelValueTable,
  professionalTable,
  reportDocument,
  safeWordFilePart,
  sectionHeading,
  verticalSpace
} from './word-design';

export async function exportConsolidatedWord(data: ConsolidatedMetricAnalysis, period: string) {
  const children: (Paragraph | Table)[] = [];
  const periodLabel = period || 'Histórico seleccionado';
  const priorityItems = data.items.filter(item => item.findings > 0).slice(0, 15);
  children.push(
    sectionHeading('Resumen ejecutivo'),
    bodyParagraph(metricStatusDescriptions[data.status]),
    labelValueTable([
      ['Indicador consolidado', data.score === null ? 'Sin medición' : `${formatPercent(data.score)} · ${metricStatusLabels[data.status]}`],
      ['Comportamiento', metricTrendLabels[data.trend]],
      ['Fincas analizadas', String(data.farms)],
      ['Aseguramientos revisados', String(data.records.length)]
    ]),
    sectionHeading('Resultado por capítulo'),
    bodyParagraph('Los porcentajes resumen el cumplimiento de los criterios aplicables en el periodo seleccionado. El peso es la participación oficial de cada capítulo.'),
    professionalTable([
      ['Capítulo', 'Indicador', 'Peso', 'Hallazgos', 'Criterios aplicables', 'Fincas', 'Estado'],
      ...data.chapters.map(chapter => [
        `${chapter.id}. ${chapter.title}`,
        formatPercent(chapter.score),
        `${Math.round((CHAPTER_WEIGHTS[chapter.id] || 0) * 100)}%`,
        String(chapter.findings),
        String(chapter.applicable),
        String(chapter.farms),
        metricStatusLabels[chapter.status]
      ])
    ], {compact: true, firstColumnBold: true}),
    sectionHeading('Ítems prioritarios')
  );
  if (priorityItems.length) {
    children.push(professionalTable([
      ['Ítem', 'Capítulo', 'Hallazgos', 'Frecuencia', 'Descripción'],
      ...priorityItems.map(item => [
        item.id,
        `${item.chapter}. ${item.chapterTitle}`,
        String(item.findings),
        `${item.rate}%`,
        item.text
      ])
    ], {compact: true}));
  } else {
    children.push(bodyParagraph('Ningún ítem acumula hallazgos en el periodo seleccionado.'));
  }

  const latestByFarm = new Map<string, typeof data.records[number]>();
  for (const record of data.records) {
    const key = farmKey(record.visit.farm);
    const previous = latestByFarm.get(key);
    if (!previous || record.date > previous.date || (record.date === previous.date && (record.visit.revision || 0) > (previous.visit.revision || 0))) {
      latestByFarm.set(key, record);
    }
  }
  const correctiveItems = [...latestByFarm.values()].flatMap(record =>
    findings(record.visit).map(problem => ({
      farm: record.visit.farm,
      date: record.date,
      id: problem.id,
      text: problem.text,
      observation: problem.answer.observation,
      recommendation: problem.answer.recommendation || 'Definir acción correctiva',
      owner: problem.action.owner || 'Sin asignar',
      due: problem.action.due || 'Sin definir',
      status: actionLabels[problem.action.status] || problem.action.status,
      closure: problem.action.closure || 'Pendiente'
    }))
  );

  children.push(sectionHeading('Hallazgos y acciones correctivas por finca'));
  if (correctiveItems.length) {
    for (const item of correctiveItems) {
      children.push(
        sectionHeading(`${item.farm} · ${item.id}`, HeadingLevel.HEADING_2),
        bodyParagraph(item.text, {bold: true, color: '263E4A', keepNext: true}),
        callout('Hallazgo', item.observation || 'Sin observación registrada en este informe.', 'finding'),
        verticalSpace(100),
        callout('Acción recomendada', item.recommendation, 'recommendation'),
        verticalSpace(100),
        labelValueTable([
          ['Fecha del aseguramiento', item.date],
          ['Responsable', item.owner],
          ['Fecha objetivo', item.due],
          ['Estado', item.status],
          ['Verificación de cierre', item.closure]
        ]),
        verticalSpace(80)
      );
    }
  } else {
    children.push(callout('Resultado', 'Las últimas visitas revisadas no registran respuestas No.', 'neutral'));
  }

  children.push(sectionHeading('Tendencia del periodo'));
  if (data.timeline.length) {
    children.push(professionalTable([
      ['Periodo', 'Indicador', 'Hallazgos', 'Aseguramientos'],
      ...data.timeline.map(point => [
        point.period,
        formatPercent(point.score),
        String(point.findings),
        String(point.reports)
      ])
    ], {compact: true}));
  } else {
    children.push(bodyParagraph('No hay periodos con aseguramientos revisados.'));
  }

  const doc = reportDocument({
    title: 'Consolidado de aseguramientos',
    description: 'Resultados consolidados del programa de aseguramiento técnico',
    reportLabel: 'Consolidado de aseguramientos',
    detail: periodLabel,
    cover: coverPage({
      label: 'Informe técnico consolidado',
      title: 'Consolidado de aseguramientos',
      subtitle: 'Aseguramiento Aptus · Resultados, hallazgos y acciones por finca',
      meta: [
        ['Periodo', periodLabel],
        ['Fincas analizadas', String(data.farms)],
        ['Aseguramientos revisados', String(data.records.length)]
      ],
      score: data.score === null ? '—' : formatPercent(data.score),
      status: metricStatusLabels[data.status],
      statusKey: data.status
    }),
    body: children
  });
  await download(
    await Packer.toBlob(doc),
    `AVGUST CARE 360 - Informe consolidado - ${safeWordFilePart(periodLabel)}.docx`
  );
}
