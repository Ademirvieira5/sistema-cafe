export type ChequeOcrFields={bankName:string;agency:string;accountNumber:string;checkNumber:string;issuerName:string;amount:string;dueDate:string};

const banks=["Banco do Brasil","Bradesco","Caixa Econômica Federal","Itaú","Santander","Sicoob","Sicredi","Banco Mercantil","Banco Inter","Nubank"];
const clean=(text:string)=>text.replace(/\s+/g," ").trim();
const brDate=(raw:string)=>{const match=raw.match(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);if(!match)return"";const year=match[3].length===2?`20${match[3]}`:match[3];return `${year}-${match[2].padStart(2,"0")}-${match[1].padStart(2,"0")}`};
const first=(text:string,patterns:RegExp[])=>{for(const pattern of patterns){const value=text.match(pattern)?.[1];if(value)return clean(value)}return""};

export function parseChequeText(source:string):ChequeOcrFields{
  const text=source.replace(/[|]/g," "),flat=clean(text),lower=flat.toLocaleLowerCase("pt-BR");
  const known=banks.find(bank=>lower.includes(bank.toLocaleLowerCase("pt-BR")))||"";
  const amount=first(flat,[/(?:R\$|VALOR)\s*[:.]?\s*([\d.]+,\d{2})/i,/\*\s*([\d.]+,\d{2})\s*\*/]);
  const dateText=first(flat,[/(?:BOM PARA|PAGUE-SE EM|DATA)\s*[:.]?\s*(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})/i,/(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})/]);
  return{
    bankName:known||first(flat,[/(?:BANCO)\s*[:.]?\s*([A-ZÁ-Ú][A-ZÁ-Ú\s]{2,28})/i]),
    agency:first(flat,[/(?:AG(?:Ê|E)NCIA|AG)\s*[:.]?\s*([\d-]{2,12})/i]),
    accountNumber:first(flat,[/(?:CONTA(?:\s+CORRENTE)?|C\/C)\s*[:.]?\s*([\d.-]{3,20})/i]),
    checkNumber:first(flat,[/(?:CHEQUE|CH(?:E|Q)?)\s*(?:N[º°O.]*)?\s*[:.]?\s*([\d-]{3,20})/i]),
    issuerName:first(flat,[/(?:EMITENTE|ASSINATURA)\s*[:.]?\s*([A-ZÁ-Ú][A-ZÁ-Ú\s.]{2,60})/i]),
    amount,
    dueDate:brDate(dateText),
  };
}
