import {HeadingLevel, Packer, Paragraph, Table} from 'docx';
import {download} from './export-word';
import {actionLabels, metricStatusDescriptions, metricStatusLabels, metricTrendLabels} from './model';
import type {FarmMetricAnalysis} from './metric-analysis';
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

export async function exportFarmMetricsWord(data: FarmMetricAnalysis) {
  const children: (Paragraph | Table)[] = [];
  const latest = data.latest;
  children.push(sectionHeading('Resumen ejecutivo'));
  if (latest) {
    children.push(
      bodyParagraph(metricStatusDescriptions[latest.status]),
      labelValueTable([
        ['Indicador de aseguramiento', `${formatPercent(latest.score)} · ${metricStatusLabels[latest.status]}`],
        ['Puntos oficiales ganados', `${latest.pointsEarned}/100`],
        ['Alcance evaluado', `${latest.evaluatedChapters} de 5 capítulos (${latest.weightedCoveragePct}% del peso)`],
        ['Variación desde la primera medición', `${metricTrendLabels[data.trend]}${data.delta === null ? '' : ` (${data.delta > 0 ? '+' : ''}${data.delta} puntos)`}`],
        ['Informes revisados con indicador', String(data.records.length)]
      ])
    );
  } else {
    children.push(bodyParagraph('Aún no hay mediciones revisadas para esta finca.'));
  }

  children.push(sectionHeading('Resumen anual'));
  if (data.yearly.length) {
    children.push(professionalTable([
      ['Año', 'Indicador promedio', 'Cierre del año', 'Visitas', 'Estado'],
      ...data.yearly.map(year => [
        year.year,
        formatPercent(year.average),
        formatPercent(year.closing),
        String(year.visits),
        metricStatusLabels[year.status]
      ])
    ], {compact: true}));
  } else {
    children.push(bodyParagraph('No hay cierres anuales en el periodo analizado.'));
  }

  children.push(
    sectionHeading('Resultado por capítulo · última visita'),
    bodyParagraph('El indicador porcentual muestra el nivel de cumplimiento de cada capítulo evaluado. El peso es la participación oficial de ese capítulo.'),
    professionalTable([
      ['Capítulo', 'Indicador', 'Peso', 'Hallazgos', 'Criterios aplicables', 'Estado'],
      ...data.chapters.map(chapter => [
        `${chapter.id}. ${chapter.title}`,
        formatPercent(chapter.score),
        `${chapter.weightPct}%`,
        String(chapter.findings),
        String(chapter.applicable),
        metricStatusLabels[chapter.status]
      ])
    ], {compact: true, firstColumnBold: true})
  );

  children.push(sectionHeading('Hallazgos y acciones correctivas · última visita'));
  if (data.problems.length) {
    for (const problem of data.problems) {
      children.push(
        sectionHeading(`${problem.id} · ${problem.text}`, HeadingLevel.HEADING_2),
        callout(
          'Hallazgo',
          problem.observation || 'Sin observación registrada en este informe.',
          'finding'
        ),
        verticalSpace(100),
        callout(
          'Recomendación',
          problem.recommendation || 'Definir y documentar la acción correctiva.',
          'recommendation'
        ),
        verticalSpace(100),
        labelValueTable([
          ['Responsable', problem.action.owner || 'Sin asignar'],
          ['Fecha objetivo', problem.action.due || 'Sin definir'],
          ['Estado', actionLabels[problem.action.status as keyof typeof actionLabels] || problem.action.status],
          ['Cierre', problem.action.closure || 'Pendiente']
        ]),
        verticalSpace(80)
      );
    }
  } else {
    children.push(callout('Resultado', 'No se identificaron respuestas No en la última evaluación.', 'neutral'));
  }

  children.push(sectionHeading('Historial de aseguramientos'));
  if (data.records.length) {
    children.push(professionalTable([
      ['Fecha', 'Indicador', 'Puntos ganados', 'Capítulos evaluados', 'Estado', 'Responsable', 'Hallazgos'],
      ...data.records.map(record => [
        record.date,
        formatPercent(record.score),
        `${record.pointsEarned}/100`,
        `${record.evaluatedChapters}/5 · ${record.weightedCoveragePct}%`,
        metricStatusLabels[record.status],
        record.responsible || 'Sin registrar',
        String(record.findings)
      ])
    ], {compact: true}));
  } else {
    children.push(bodyParagraph('No hay aseguramientos revisados en el historial de esta finca.'));
  }

  const doc = reportDocument({
    title: `Informe de evolución · ${data.farm}`,
    description: 'Evolución del indicador de aseguramiento técnico por finca',
    reportLabel: 'Evolución por finca',
    detail: data.farm,
    cover: coverPage({
      label: 'Informe de evolución por finca',
      title: data.farm,
      subtitle: 'Aseguramiento Aptus · Acompañamiento en campo',
      meta: [
        ['Finca', data.farm],
        ['Periodo analizado', `${data.first?.date || 'Sin mediciones'} a ${latest?.date || 'Sin mediciones'}`],
        ['Aseguramientos revisados', String(data.records.length)]
      ],
      score: latest ? formatPercent(latest.score) : '—',
      status: latest ? metricStatusLabels[latest.status] : 'Sin medición',
      statusKey: latest?.status || 'pending'
    }),
    body: children
  });
  await download(
    await Packer.toBlob(doc),
    `AVGUST CARE 360 - Informe de evolución - ${safeWordFilePart(data.farm)} - ${safeWordFilePart(latest?.date || 'sin-fecha')}.docx`
  );
}
