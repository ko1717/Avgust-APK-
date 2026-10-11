import {
  AlignmentType,
  BorderStyle,
  Footer,
  Header,
  HeadingLevel,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
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

const statusColors:Record<MetricStatus,string>={
  healthy:WORD_COLORS.green,
  acceptable:WORD_COLORS.gold,
  critical:WORD_COLORS.critical,
  pending:WORD_COLORS.muted
};

type Block=Paragraph|Table;
type CoverOptions={
  label:string;
  title:string;
  subtitle:string;
  meta:Array<[string,string]>;
  score?:string;
  status?:string;
  statusKey?:MetricStatus;
};

const noBorders={
  top:{style:BorderStyle.NONE,size:0,color:WORD_COLORS.white},
  bottom:{style:BorderStyle.NONE,size:0,color:WORD_COLORS.white},
  left:{style:BorderStyle.NONE,size:0,color:WORD_COLORS.white},
  right:{style:BorderStyle.NONE,size:0,color:WORD_COLORS.white},
  insideHorizontal:{style:BorderStyle.NONE,size:0,color:WORD_COLORS.white},
  insideVertical:{style:BorderStyle.NONE,size:0,color:WORD_COLORS.white}
};

const tableBorders={
  top:{style:BorderStyle.SINGLE,size:4,color:WORD_COLORS.line},
  bottom:{style:BorderStyle.SINGLE,size:4,color:WORD_COLORS.line},
  left:{style:BorderStyle.SINGLE,size:4,color:WORD_COLORS.line},
  right:{style:BorderStyle.SINGLE,size:4,color:WORD_COLORS.line},
  insideHorizontal:{style:BorderStyle.SINGLE,size:4,color:WORD_COLORS.line},
  insideVertical:{style:BorderStyle.SINGLE,size:4,color:WORD_COLORS.line}
};

export function cleanWordText(value:unknown):string{
  return String(value??'')
    .replace(/\*\*([\s\S]*?)\*\*/g,'$1')
    .replace(/__([\s\S]*?)__/g,'$1')
    .replace(/`([^`]+)`/g,'$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm,'')
    .trim();
}

export function safeWordFilePart(value:string):string{
  return cleanWordText(value)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g,'')
    .replace(/\s+/g,' ')
    .trim()
    .slice(0,80)||'Sin nombre';
}

export function wordText(value:string,options:{bold?:boolean;color?:string;size?:number;italics?:boolean}={}):TextRun{
  return new TextRun({
    text:cleanWordText(value),
    font:'Aptos',
    bold:options.bold,
    italics:options.italics,
    color:options.color||WORD_COLORS.ink,
    size:options.size
  });
}

export function bodyParagraph(value:string,options:{bold?:boolean;color?:string;after?:number;before?:number;keepNext?:boolean}={}):Paragraph{
  return new Paragraph({
    children:[wordText(value,{bold:options.bold,color:options.color})],
    keepNext:options.keepNext,
    spacing:{before:options.before||0,after:options.after??140,line:276}
  });
}

export function sectionHeading(value:string,level:typeof HeadingLevel.HEADING_1|typeof HeadingLevel.HEADING_2=HeadingLevel.HEADING_1):Paragraph{
  return new Paragraph({
    text:cleanWordText(value),
    heading:level,
    keepNext:true,
    spacing:level===HeadingLevel.HEADING_1?{before:360,after:150}:{before:240,after:100}
  });
}

function cellParagraph(value:string,header=false,alignment=AlignmentType.LEFT):Paragraph{
  return new Paragraph({
    children:[wordText(value,{bold:header,color:header?WORD_COLORS.white:WORD_COLORS.ink,size:header?19:18})],
    alignment,
    spacing:{after:0,line:240}
  });
}

export function professionalTable(
  rows:string[][],
  options:{header?:boolean;columnWidths?:number[];compact?:boolean;firstColumnBold?:boolean}={}
):Table{
  const header=options.header??true;
  return new Table({
    width:{size:100,type:WidthType.PERCENTAGE},
    columnWidths:options.columnWidths,
    borders:tableBorders,
    rows:rows.map((row,rowIndex)=>{
      const isHeader=header&&rowIndex===0;
      return new TableRow({
        tableHeader:isHeader,
        cantSplit:true,
        children:row.map((value,columnIndex)=>new TableCell({
          shading:{
            type:ShadingType.CLEAR,
            fill:isHeader?WORD_COLORS.navy:rowIndex%2===0?WORD_COLORS.paleGray:WORD_COLORS.white
          },
          margins:{
            top:options.compact?75:110,
            bottom:options.compact?75:110,
            left:110,
            right:110
          },
          verticalAlign:VerticalAlign.CENTER,
          children:[
            new Paragraph({
              children:[wordText(value,{
                bold:isHeader||(options.firstColumnBold===true&&columnIndex===0),
                color:isHeader?WORD_COLORS.white:WORD_COLORS.ink,
                size:isHeader?19:18
              })],
              spacing:{after:0,line:230}
            })
          ]
        }))
      });
    })
  });
}

export function labelValueTable(rows:Array<[string,string]>,columnWidths=[2200,7000]):Table{
  return new Table({
    width:{size:100,type:WidthType.PERCENTAGE},
    columnWidths,
    borders:tableBorders,
    rows:rows.map((row,index)=>new TableRow({
      cantSplit:true,
      children:[
        new TableCell({
          shading:{type:ShadingType.CLEAR,fill:WORD_COLORS.paleGray},
          margins:{top:100,bottom:100,left:120,right:120},
          verticalAlign:VerticalAlign.CENTER,
          children:[new Paragraph({children:[wordText(row[0],{bold:true,color:WORD_COLORS.navy,size:18})],spacing:{after:0}})]
        }),
        new TableCell({
          shading:{type:ShadingType.CLEAR,fill:index%2?WORD_COLORS.paleGray:WORD_COLORS.white},
          margins:{top:100,bottom:100,left:120,right:120},
          verticalAlign:VerticalAlign.CENTER,
          children:[new Paragraph({children:[wordText(row[1],{size:18})],spacing:{after:0}})]
        })
      ]
    }))
  });
}

export function callout(
  label:string,
  value:string,
  tone:'finding'|'recommendation'|'neutral'='neutral'
):Table{
  const fill=tone==='finding'?WORD_COLORS.paleGold:tone==='recommendation'?WORD_COLORS.paleGreen:WORD_COLORS.paleBlue;
  const accent=tone==='finding'?WORD_COLORS.gold:tone==='recommendation'?WORD_COLORS.green:WORD_COLORS.blue;
  return new Table({
    width:{size:100,type:WidthType.PERCENTAGE},
    borders:noBorders,
    rows:[new TableRow({
      cantSplit:true,
      children:[
        new TableCell({
          width:{size:180,type:WidthType.DXA},
          shading:{type:ShadingType.CLEAR,fill:accent},
          margins:{top:0,bottom:0,left:0,right:0},
          children:[new Paragraph({children:[]})]
        }),
        new TableCell({
          shading:{type:ShadingType.CLEAR,fill},
          margins:{top:130,bottom:130,left:170,right:170},
          children:[
            new Paragraph({
              children:[wordText(label.toUpperCase(),{bold:true,color:WORD_COLORS.navy,size:17})],
              keepNext:true,
              spacing:{after:55}
            }),
            new Paragraph({children:[wordText(value,{size:19})],spacing:{after:0,line:250}})
          ]
        })
      ]
    })]
  });
}

function brandBar():Table{
  return new Table({
    width:{size:100,type:WidthType.PERCENTAGE},
    columnWidths:[6500,2700],
    borders:noBorders,
    rows:[new TableRow({
      cantSplit:true,
      children:[
        new TableCell({
          shading:{type:ShadingType.CLEAR,fill:WORD_COLORS.navy},
          margins:{top:210,bottom:210,left:260,right:220},
          verticalAlign:VerticalAlign.CENTER,
          children:[new Paragraph({
            children:[
              wordText('AVGUST',{bold:true,color:WORD_COLORS.white,size:28}),
              wordText('  CROP PROTECTION',{color:'C5D3D8',size:16})
            ],
            spacing:{after:0}
          })]
        }),
        new TableCell({
          shading:{type:ShadingType.CLEAR,fill:WORD_COLORS.blue},
          margins:{top:210,bottom:210,left:200,right:240},
          verticalAlign:VerticalAlign.CENTER,
          children:[new Paragraph({
            children:[wordText('CARE 360',{bold:true,color:WORD_COLORS.white,size:27})],
            alignment:AlignmentType.RIGHT,
            spacing:{after:0}
          })]
        })
      ]
    })]
  });
}

function accentRule():Table{
  return new Table({
    width:{size:100,type:WidthType.PERCENTAGE},
    columnWidths:[4600,2800,1800],
    borders:noBorders,
    rows:[new TableRow({
      height:{value:90,rule:'exact'},
      children:[
        new TableCell({shading:{type:ShadingType.CLEAR,fill:WORD_COLORS.blue},children:[new Paragraph('')]}),
        new TableCell({shading:{type:ShadingType.CLEAR,fill:WORD_COLORS.green},children:[new Paragraph('')]}),
        new TableCell({shading:{type:ShadingType.CLEAR,fill:WORD_COLORS.gold},children:[new Paragraph('')]})
      ]
    })]
  });
}

export function coverPage(options:CoverOptions):Block[]{
  const blocks:Block[]=[
    brandBar(),
    accentRule(),
    new Paragraph({
      children:[wordText(options.label.toUpperCase(),{bold:true,color:WORD_COLORS.blue,size:18})],
      spacing:{before:900,after:180}
    }),
    new Paragraph({
      children:[wordText(options.title,{bold:true,color:WORD_COLORS.navy,size:42})],
      spacing:{after:190,line:480},
      keepNext:true
    }),
    new Paragraph({
      children:[wordText(options.subtitle,{color:WORD_COLORS.muted,size:24})],
      spacing:{after:520,line:320}
    }),
    labelValueTable(options.meta)
  ];
  if(options.score||options.status){
    const accent=statusColors[options.statusKey||'pending'];
    blocks.push(
      new Paragraph({spacing:{before:240,after:0}}),
      new Table({
        width:{size:100,type:WidthType.PERCENTAGE},
        columnWidths:[2900,6300],
        borders:noBorders,
        rows:[new TableRow({
          cantSplit:true,
          children:[
            new TableCell({
              shading:{type:ShadingType.CLEAR,fill:accent},
              margins:{top:170,bottom:170,left:190,right:190},
              verticalAlign:VerticalAlign.CENTER,
              children:[new Paragraph({
                children:[wordText(options.score||'—',{bold:true,color:WORD_COLORS.white,size:38})],
                alignment:AlignmentType.CENTER,
                spacing:{after:0}
              })]
            }),
            new TableCell({
              shading:{type:ShadingType.CLEAR,fill:WORD_COLORS.paleGray},
              margins:{top:150,bottom:150,left:220,right:180},
              verticalAlign:VerticalAlign.CENTER,
              children:[
                new Paragraph({children:[wordText('ESTADO DEL ASEGURAMIENTO',{bold:true,color:WORD_COLORS.muted,size:16})],spacing:{after:50}}),
                new Paragraph({children:[wordText(options.status||'Sin medición',{bold:true,color:WORD_COLORS.navy,size:25})],spacing:{after:0}})
              ]
            })
          ]
        })]
      })
    );
  }
  blocks.push(new Paragraph({children:[new PageBreak()]}));
  return blocks;
}

export function documentHeader(reportLabel:string):Header{
  return new Header({
    children:[
      new Table({
        width:{size:100,type:WidthType.PERCENTAGE},
        columnWidths:[4700,4500],
        borders:{
          ...noBorders,
          bottom:{style:BorderStyle.SINGLE,size:8,color:WORD_COLORS.blue}
        },
        rows:[new TableRow({
          children:[
            new TableCell({
              margins:{top:40,bottom:90,left:0,right:80},
              children:[cellParagraph('AVGUST  ·  CARE 360',true)]
            }),
            new TableCell({
              margins:{top:40,bottom:90,left:80,right:0},
              children:[new Paragraph({
                children:[wordText(reportLabel.toUpperCase(),{bold:true,color:WORD_COLORS.muted,size:15})],
                alignment:AlignmentType.RIGHT,
                spacing:{after:0}
              })]
            })
          ]
        })]
      })
    ]
  });
}

export function documentFooter():Footer{
  return new Footer({
    children:[new Paragraph({
      children:[
        wordText('AVGUST CARE 360  ·  Documento técnico  ·  Página ',{color:WORD_COLORS.muted,size:15}),
        new TextRun({children:[PageNumber.CURRENT],font:'Aptos',color:WORD_COLORS.muted,size:15}),
        wordText(' de ',{color:WORD_COLORS.muted,size:15}),
        new TextRun({children:[PageNumber.TOTAL_PAGES],font:'Aptos',color:WORD_COLORS.muted,size:15})
      ],
      alignment:AlignmentType.RIGHT,
      spacing:{before:80,after:0}
    })]
  });
}

export const professionalDocumentStyles={
  default:{
    document:{
      run:{font:'Aptos',size:20,color:WORD_COLORS.ink},
      paragraph:{spacing:{after:140,line:276}}
    },
    title:{run:{font:'Aptos Display',size:42,bold:true,color:WORD_COLORS.navy}},
    heading1:{run:{font:'Aptos Display',size:28,bold:true,color:WORD_COLORS.navy}},
    heading2:{run:{font:'Aptos Display',size:23,bold:true,color:WORD_COLORS.blue}}
  }
};
