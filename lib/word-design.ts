import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  PageNumber,
  Paragraph,
  SectionType,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType
} from 'docx';
import type {MetricStatus} from './model';

export const WORD_COLORS = {
  ink: '263640',
  muted: '60737D',
  navy: '263E4A',
  blue: '00A9CE',
  green: '78BE20',
  gold: 'F2A900',
  white: 'FFFFFF',
  line: 'DCE5E8',
  paleBlue: 'EAF7FB',
  paleGreen: 'F0F8E8',
  paleGold: 'FFF7DF',
  paleGray: 'F4F7F8',
  critical: 'C84B31'
} as const;

const PAGE_WIDTH = 11906;
const PAGE_HEIGHT = 16838;
const PAGE_MARGIN_X = 1080;
export const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN_X * 2;

const statusColors: Record<MetricStatus, string> = {
  healthy: WORD_COLORS.green,
  acceptable: WORD_COLORS.gold,
  critical: WORD_COLORS.critical,
  pending: WORD_COLORS.muted
};

type Block = Paragraph | Table;
type CoverOptions = {
  label: string;
  title: string;
  subtitle: string;
  meta: Array<[string, string]>;
  score?: string;
  status?: string;
  statusKey?: MetricStatus;
  notice?: {label: string; text: string; tone?: 'finding' | 'recommendation' | 'neutral'};
};

const noBorders = {
  top: {style: BorderStyle.NONE, size: 0, color: WORD_COLORS.white},
  bottom: {style: BorderStyle.NONE, size: 0, color: WORD_COLORS.white},
  left: {style: BorderStyle.NONE, size: 0, color: WORD_COLORS.white},
  right: {style: BorderStyle.NONE, size: 0, color: WORD_COLORS.white},
  insideHorizontal: {style: BorderStyle.NONE, size: 0, color: WORD_COLORS.white},
  insideVertical: {style: BorderStyle.NONE, size: 0, color: WORD_COLORS.white}
};

const tableBorders = {
  top: {style: BorderStyle.SINGLE, size: 4, color: WORD_COLORS.line},
  bottom: {style: BorderStyle.SINGLE, size: 4, color: WORD_COLORS.line},
  left: {style: BorderStyle.SINGLE, size: 4, color: WORD_COLORS.line},
  right: {style: BorderStyle.SINGLE, size: 4, color: WORD_COLORS.line},
  insideHorizontal: {style: BorderStyle.SINGLE, size: 4, color: WORD_COLORS.line},
  insideVertical: {style: BorderStyle.SINGLE, size: 4, color: WORD_COLORS.line}
};

const pageSize = {width: PAGE_WIDTH, height: PAGE_HEIGHT};

function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  return '';
}

function tidyText(value: unknown): string {
  return asText(value)
    .replace(/\r\n/g, '\n')
    .replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([\s\S]*?)\*\*/g, '$1')
    .replace(/__([\s\S]*?)__/g, '$1')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:]|$)/g, '$1$2')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/\*\*/g, '')
    .replace(/[ \t]*\n[ \t]*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ');
}

/** Remove markdown markers so client documents never show raw asterisks. */
export function cleanWordText(value: unknown): string {
  return tidyText(value).trim();
}

export function safeWordFilePart(value: string): string {
  let safe = '';
  for (const char of cleanWordText(value)) {
    const code = char.charCodeAt(0);
    safe += code < 32 || '<>:"/\\|?*'.includes(char) ? ' ' : char;
  }
  return safe.replace(/\s+/g, ' ').trim().slice(0, 80) || 'Sin nombre';
}

export function formatQuantity(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'Sin medición';
  return `${formatQuantity(value)}%`;
}

export function wordText(value: string, options: {bold?: boolean; color?: string; size?: number; italics?: boolean; preserveSpacing?: boolean} = {}): TextRun {
  const text = tidyText(value);
  return new TextRun({
    text: options.preserveSpacing ? text : text.trim(),
    font: 'Arial',
    bold: options.bold,
    italics: options.italics,
    color: options.color || WORD_COLORS.ink,
    size: options.size
  });
}

export function bodyParagraph(value: string, options: {bold?: boolean; color?: string; after?: number; before?: number; keepNext?: boolean} = {}): Paragraph {
  return new Paragraph({
    children: [wordText(value, {bold: options.bold, color: options.color})],
    keepNext: options.keepNext,
    spacing: {before: options.before || 0, after: options.after ?? 140, line: 276}
  });
}

export function verticalSpace(after = 140): Paragraph {
  return new Paragraph({spacing: {before: 0, after}, children: []});
}

export function sectionHeading(value: string, level: typeof HeadingLevel.HEADING_1 | typeof HeadingLevel.HEADING_2 = HeadingLevel.HEADING_1): Paragraph {
  const major = level === HeadingLevel.HEADING_1;
  return new Paragraph({
    text: cleanWordText(value),
    heading: level,
    keepNext: true,
    border: major ? {bottom: {style: BorderStyle.SINGLE, size: 8, color: WORD_COLORS.line, space: 1}} : undefined,
    spacing: major ? {before: 320, after: 140} : {before: 220, after: 80}
  });
}

function paragraph(value: string, options: {bold?: boolean; color?: string; size?: number; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number} = {}): Paragraph {
  return new Paragraph({
    children: [wordText(value, options)],
    alignment: options.alignment,
    spacing: {after: options.after ?? 0, line: 240}
  });
}

function fittedWidths(columnWidths: number[] | undefined, columnCount: number): number[] | undefined {
  if (!columnWidths || columnWidths.length !== columnCount) return undefined;
  const sum = columnWidths.reduce((total, width) => total + width, 0);
  return sum === CONTENT_WIDTH ? columnWidths : undefined;
}

export function professionalTable(
  rows: string[][],
  options: {header?: boolean; columnWidths?: number[]; compact?: boolean; firstColumnBold?: boolean} = {}
): Table {
  const header = options.header ?? true;
  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const columnWidths = fittedWidths(options.columnWidths, columnCount);
  return new Table({
    width: {size: CONTENT_WIDTH, type: WidthType.DXA},
    columnWidths,
    layout: columnWidths ? TableLayoutType.FIXED : TableLayoutType.AUTOFIT,
    borders: tableBorders,
    rows: rows.map((row, rowIndex) => {
      const isHeader = header && rowIndex === 0;
      return new TableRow({
        tableHeader: isHeader,
        cantSplit: true,
        children: row.map((value, columnIndex) => new TableCell({
          shading: {
            type: ShadingType.CLEAR,
            fill: isHeader ? WORD_COLORS.navy : rowIndex % 2 === 0 ? WORD_COLORS.paleGray : WORD_COLORS.white
          },
          margins: {
            top: options.compact ? 70 : 100,
            bottom: options.compact ? 70 : 100,
            left: 110,
            right: 110
          },
          verticalAlign: VerticalAlignTable.CENTER,
          children: [paragraph(value, {
            bold: isHeader || (options.firstColumnBold === true && columnIndex === 0),
            color: isHeader ? WORD_COLORS.white : WORD_COLORS.ink,
            size: isHeader ? 17 : 18
          })]
        }))
      });
    })
  });
}

export function labelValueTable(rows: Array<[string, string]>): Table {
  const columns = fittedWidths([2860, CONTENT_WIDTH - 2860], 2)!;
  return new Table({
    width: {size: CONTENT_WIDTH, type: WidthType.DXA},
    columnWidths: columns,
    layout: TableLayoutType.FIXED,
    borders: tableBorders,
    rows: rows.map((row, index) => new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          width: {size: columns[0], type: WidthType.DXA},
          shading: {type: ShadingType.CLEAR, fill: WORD_COLORS.paleGray},
          margins: {top: 90, bottom: 90, left: 120, right: 120},
          verticalAlign: VerticalAlignTable.CENTER,
          children: [paragraph(row[0], {bold: true, color: WORD_COLORS.navy, size: 18})]
        }),
        new TableCell({
          width: {size: columns[1], type: WidthType.DXA},
          shading: {type: ShadingType.CLEAR, fill: index % 2 ? WORD_COLORS.paleGray : WORD_COLORS.white},
          margins: {top: 90, bottom: 90, left: 120, right: 120},
          verticalAlign: VerticalAlignTable.CENTER,
          children: [paragraph(row[1], {size: 18})]
        })
      ]
    }))
  });
}

export function callout(
  label: string,
  value: string,
  tone: 'finding' | 'recommendation' | 'neutral' = 'neutral'
): Table {
  const fill = tone === 'finding' ? WORD_COLORS.paleGold : tone === 'recommendation' ? WORD_COLORS.paleGreen : WORD_COLORS.paleBlue;
  const accent = tone === 'finding' ? WORD_COLORS.gold : tone === 'recommendation' ? WORD_COLORS.green : WORD_COLORS.blue;
  const accentWidth = 140;
  return new Table({
    width: {size: CONTENT_WIDTH, type: WidthType.DXA},
    columnWidths: [accentWidth, CONTENT_WIDTH - accentWidth],
    layout: TableLayoutType.FIXED,
    borders: noBorders,
    rows: [new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          width: {size: accentWidth, type: WidthType.DXA},
          shading: {type: ShadingType.CLEAR, fill: accent},
          margins: {top: 0, bottom: 0, left: 0, right: 0},
          children: [new Paragraph({children: [wordText(' ', {color: accent, size: 8})], spacing: {after: 0}})]
        }),
        new TableCell({
          width: {size: CONTENT_WIDTH - accentWidth, type: WidthType.DXA},
          shading: {type: ShadingType.CLEAR, fill},
          margins: {top: 120, bottom: 120, left: 170, right: 170},
          children: [
            paragraph(label.toUpperCase(), {bold: true, color: WORD_COLORS.navy, size: 16, after: 50}),
            paragraph(value, {size: 19})
          ]
        })
      ]
    })]
  });
}

function brandBar(): Table {
  const mark = 2920;
  return new Table({
    width: {size: CONTENT_WIDTH, type: WidthType.DXA},
    columnWidths: [CONTENT_WIDTH - mark, mark],
    layout: TableLayoutType.FIXED,
    borders: noBorders,
    rows: [new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          shading: {type: ShadingType.CLEAR, fill: WORD_COLORS.navy},
          margins: {top: 180, bottom: 180, left: 240, right: 180},
          verticalAlign: VerticalAlignTable.CENTER,
          children: [new Paragraph({
            children: [
              wordText('AVGUST', {bold: true, color: WORD_COLORS.white, size: 28}),
              wordText('  CROP PROTECTION', {color: 'C5D3D8', size: 15, preserveSpacing: true})
            ],
            spacing: {after: 0}
          })]
        }),
        new TableCell({
          shading: {type: ShadingType.CLEAR, fill: WORD_COLORS.blue},
          margins: {top: 180, bottom: 180, left: 160, right: 220},
          verticalAlign: VerticalAlignTable.CENTER,
          children: [paragraph('CARE 360', {bold: true, color: WORD_COLORS.white, size: 26, alignment: AlignmentType.RIGHT})]
        })
      ]
    })]
  });
}

function accentRule(): Table {
  const blue = Math.round(CONTENT_WIDTH * 0.48);
  const green = Math.round(CONTENT_WIDTH * 0.3);
  const gold = CONTENT_WIDTH - blue - green;
  return new Table({
    width: {size: CONTENT_WIDTH, type: WidthType.DXA},
    columnWidths: [blue, green, gold],
    layout: TableLayoutType.FIXED,
    borders: noBorders,
    rows: [new TableRow({
      height: {value: 90, rule: 'exact'},
      children: [
        new TableCell({shading: {type: ShadingType.CLEAR, fill: WORD_COLORS.blue}, children: [new Paragraph('')]}),
        new TableCell({shading: {type: ShadingType.CLEAR, fill: WORD_COLORS.green}, children: [new Paragraph('')]}),
        new TableCell({shading: {type: ShadingType.CLEAR, fill: WORD_COLORS.gold}, children: [new Paragraph('')]})
      ]
    })]
  });
}

export function coverPage(options: CoverOptions): Block[] {
  const blocks: Block[] = [
    brandBar(),
    accentRule(),
    new Paragraph({
      children: [wordText(options.label.toUpperCase(), {bold: true, color: WORD_COLORS.blue, size: 18})],
      spacing: {before: 640, after: 140}
    }),
    new Paragraph({
      children: [wordText(options.title, {bold: true, color: WORD_COLORS.navy, size: 40})],
      spacing: {after: 120, line: 460},
      keepNext: true
    }),
    new Paragraph({
      children: [wordText(options.subtitle, {color: WORD_COLORS.muted, size: 22})],
      spacing: {after: options.notice ? 220 : 360, line: 300}
    })
  ];
  if (options.notice) {
    blocks.push(callout(options.notice.label, options.notice.text, options.notice.tone || 'neutral'), verticalSpace(220));
  }
  blocks.push(labelValueTable(options.meta));
  if (options.score || options.status) {
    const accent = statusColors[options.statusKey || 'pending'];
    const scoreWidth = 2500;
    blocks.push(
      verticalSpace(220),
      new Table({
        width: {size: CONTENT_WIDTH, type: WidthType.DXA},
        columnWidths: [scoreWidth, CONTENT_WIDTH - scoreWidth],
        layout: TableLayoutType.FIXED,
        borders: noBorders,
        rows: [new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: {size: scoreWidth, type: WidthType.DXA},
              shading: {type: ShadingType.CLEAR, fill: accent},
              margins: {top: 160, bottom: 160, left: 140, right: 140},
              verticalAlign: VerticalAlignTable.CENTER,
              children: [paragraph(options.score || '—', {bold: true, color: WORD_COLORS.white, size: 40, alignment: AlignmentType.CENTER})]
            }),
            new TableCell({
              width: {size: CONTENT_WIDTH - scoreWidth, type: WidthType.DXA},
              shading: {type: ShadingType.CLEAR, fill: WORD_COLORS.paleGray},
              margins: {top: 140, bottom: 140, left: 220, right: 180},
              verticalAlign: VerticalAlignTable.CENTER,
              children: [
                paragraph('ESTADO DEL ASEGURAMIENTO', {bold: true, color: WORD_COLORS.muted, size: 15, after: 40}),
                paragraph(options.status || 'Sin medición', {bold: true, color: WORD_COLORS.navy, size: 26})
              ]
            })
          ]
        })]
      })
    );
  }
  return blocks;
}

export function documentHeader(reportLabel: string, detail = ''): Header {
  return new Header({
    children: [
      new Table({
        width: {size: CONTENT_WIDTH, type: WidthType.DXA},
        columnWidths: [4600, CONTENT_WIDTH - 4600],
        layout: TableLayoutType.FIXED,
        borders: {
          ...noBorders,
          bottom: {style: BorderStyle.SINGLE, size: 12, color: WORD_COLORS.blue}
        },
        rows: [new TableRow({
          children: [
            new TableCell({
              width: {size: 4600, type: WidthType.DXA},
              margins: {top: 40, bottom: 80, left: 0, right: 80},
              verticalAlign: VerticalAlignTable.CENTER,
              children: [paragraph('AVGUST  ·  CARE 360', {bold: true, color: WORD_COLORS.navy, size: 18})]
            }),
            new TableCell({
              width: {size: CONTENT_WIDTH - 4600, type: WidthType.DXA},
              margins: {top: 20, bottom: 70, left: 80, right: 0},
              verticalAlign: VerticalAlignTable.CENTER,
              children: [
                paragraph(reportLabel.toUpperCase(), {bold: true, color: WORD_COLORS.blue, size: 15, alignment: AlignmentType.RIGHT}),
                ...(detail ? [paragraph(detail, {color: WORD_COLORS.muted, size: 15, alignment: AlignmentType.RIGHT})] : [])
              ]
            })
          ]
        })]
      })
    ]
  });
}

export function documentFooter(): Footer {
  return new Footer({
    children: [new Paragraph({
      border: {top: {style: BorderStyle.SINGLE, size: 8, color: WORD_COLORS.line, space: 6}},
      children: [
        wordText('AVGUST CARE 360  ·  Aseguramiento Aptus  ·  Página ', {color: WORD_COLORS.muted, size: 15, preserveSpacing: true}),
        new TextRun({children: [PageNumber.CURRENT], font: 'Arial', color: WORD_COLORS.muted, size: 15}),
        wordText(' de ', {color: WORD_COLORS.muted, size: 15, preserveSpacing: true}),
        new TextRun({children: [PageNumber.TOTAL_PAGES], font: 'Arial', color: WORD_COLORS.muted, size: 15})
      ],
      alignment: AlignmentType.RIGHT,
      spacing: {before: 60, after: 0}
    })]
  });
}

export const professionalDocumentStyles = {
  default: {
    document: {
      run: {font: 'Arial', size: 21, color: WORD_COLORS.ink},
      paragraph: {spacing: {after: 120, line: 276}}
    },
    title: {run: {font: 'Arial', size: 40, bold: true, color: WORD_COLORS.navy}},
    heading1: {run: {font: 'Arial', size: 28, bold: true, color: WORD_COLORS.navy}},
    heading2: {run: {font: 'Arial', size: 22, bold: true, color: WORD_COLORS.blue}}
  }
};

export function reportDocument(options: {
  title: string;
  description: string;
  reportLabel: string;
  detail?: string;
  cover: Block[];
  body: Block[];
}): Document {
  const margin = {left: PAGE_MARGIN_X, right: PAGE_MARGIN_X};
  return new Document({
    creator: 'AVGUST CARE 360',
    title: cleanWordText(options.title),
    description: cleanWordText(options.description),
    styles: professionalDocumentStyles,
    sections: [
      {
        properties: {
          page: {
            size: pageSize,
            margin: {...margin, top: 620, bottom: 700, header: 280, footer: 280}
          }
        },
        children: options.cover
      },
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: pageSize,
            margin: {...margin, top: 1180, bottom: 900, header: 520, footer: 460}
          }
        },
        headers: {default: documentHeader(options.reportLabel, options.detail)},
        footers: {default: documentFooter()},
        children: options.body
      }
    ]
  });
}
