export type ImportedDocumentType = "DARF" | "FGTS" | "BOLETO" | "OTHER";

const months: Record<string,string> = { janeiro:"01",fevereiro:"02",marco:"03",março:"03",abril:"04",maio:"05",junho:"06",julho:"07",agosto:"08",setembro:"09",outubro:"10",novembro:"11",dezembro:"12" };
const compact = (value:string) => value.replace(/\s+/g," ").trim();
const cents = (value?:string|null) => value ? Math.round(Number(value.replace(/\./g,"").replace(",","."))*100) : null;
const isoDate = (value?:string|null) => { if(!value)return null;const [day,month,year]=value.split("/");return `${year}-${month}-${day}` };

export function parseImportedPdfText(raw:string){
  const text=compact(raw),lower=text.toLocaleLowerCase("pt-BR");
  if(lower.includes("recibo de entrega da declaração")&&lower.includes("dctfweb"))return{ignored:true as const,reason:"DCTF_RECEIPT"};
  const isDarf=lower.includes("documento de arrecadação de receitas federais");
  const isFgts=lower.includes("guia do fgts digital")||lower.includes("gfd - guia do fgts digital");
  const isBoleto=!isDarf&&!isFgts&&(lower.includes("linha digitável")||lower.includes("linha digitavel")||lower.includes("boleto"));
  const documentType:ImportedDocumentType=isDarf?"DARF":isFgts?"FGTS":isBoleto?"BOLETO":"OTHER";
  const issuerDocument=text.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/)?.[0]??text.match(/CPF\/CNPJ do Empregador\s*(\d{2}\.\d{3}\.\d{3})/)?.[1]??null;
  const escapedDocument=issuerDocument?.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const issuerName=isDarf?(text.match(/Razão Social\s+(.+?)\s+Período de Apuração/i)?.[1]??(escapedDocument?text.match(new RegExp(`${escapedDocument}\\s+(.+?)\\s+Período de Apuração`,"i"))?.[1]:null)??null):isFgts?text.match(/Nome\/Razão Social do Empregador\s+(.+?)\s+(?:Pagar este documento até|Núm\. de Pág\.)/i)?.[1]??null:null;
  const dueBr=text.match(/Pagar (?:este documento )?até\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1]??text.match(/Data de Vencimento\s+(\d{2}\/\d{2}\/\d{4})/i)?.[1]??null;
  const namedCompetence=text.match(/\b(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\/(\d{4})\b/i);
  const numericCompetence=text.match(/Competência\s+(\d{2})\/(\d{4})/i)??text.match(/\bPA:(\d{2})\/(\d{4})/i)??(isFgts?text.match(/Tag\s+\d+\s+(\d{2})\/(\d{4})\s+MENSAL/i):null);
  const competence=namedCompetence?`${namedCompetence[2]}-${months[namedCompetence[1].toLocaleLowerCase("pt-BR")]}`:numericCompetence?`${numericCompetence[2]}-${numericCompetence[1]}`:null;
  const amountText=isDarf?text.match(/Valor Total do Documento\s*([\d.]+,\d{2})/i)?.[1]:isFgts?text.match(/Valor a recolher\s*([\d.]+,\d{2})/i)?.[1]:text.match(/(?:Valor (?:total|a pagar)|Total da Guia)\s*R?\$?\s*([\d.]+,\d{2})/i)?.[1];
  const documentNumber=isDarf?text.match(/Número do Documento\s+([\d.]+-\d)/i)?.[1]??null:isFgts?text.match(/Identificador\s+([\d-]+)/i)?.[1]??null:text.match(/(?:Nosso Número|Número do Documento)\s*:?\s*([\d./-]+)/i)?.[1]??null;
  const paymentCode=(text.match(/(?:\d{11}\s\d\s*){4}/)?.[0]??text.match(/\b\d{47,48}\b/)?.[0]??"").replace(/\s+/g,"")||null;
  const codes=isDarf?[...new Set([...text.matchAll(/\b(\d{4})\s+(?=[A-ZÀ-Ú])/g)].map(match=>match[1]).filter(code=>!code.startsWith("20")))]:[];
  return{ignored:false as const,documentType,issuerName,issuerDocument,competence,dueDate:isoDate(dueBr),documentNumber,amountCents:cents(amountText),paymentCode,details:{codes,textPreview:text.slice(0,1200)}};
}
