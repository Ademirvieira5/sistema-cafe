export type NfeParty = {
  name: string;
  tradeName: string | null;
  document: string | null;
  stateRegistration: string | null;
  address: {
    zipCode: string | null;
    street: string | null;
    number: string | null;
    complement: string | null;
    district: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    phone: string | null;
  };
};

export type NfeItem = {
  code: string;
  description: string;
  ncm: string;
  cfop: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
  estimatedKilograms: number | null;
};

export type ParsedNfe = {
  accessKey: string;
  number: string;
  series: string | null;
  issueDate: string;
  issuer: NfeParty;
  recipient: NfeParty;
  productsTotal: number;
  discount: number;
  freight: number;
  other: number;
  total: number;
  estimatedKilograms: number | null;
  estimatedPricePerSack: number | null;
  items: NfeItem[];
  installments: { number: string; dueDate: string; amount: number }[];
  operationNature: string;
  operationType: "0" | "1" | null;
  fiscalPurpose: string | null;
  referencedAccessKeys: string[];
  additionalInformation: string | null;
  funrural: { detected: boolean; rate: number | null; amount: number | null; source: string | null };
};

export type NfeClassificationCode = "PURCHASE" | "SALE" | "SALE_RETURN" | "PURCHASE_RETURN" | "TRANSFER" | "REVIEW";
export type NfeClassification = {
  code: NfeClassificationCode;
  confidence: "CONFIRMED" | "PROBABLE" | "REVIEW";
  reason: string;
  counterparty: "ISSUER" | "RECIPIENT" | null;
};

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const tagPattern = (tag: string, flags = "is") => new RegExp(`<(?:[\\w-]+:)?${escape(tag)}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${escape(tag)}>`, flags);

function decode(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim();
}

function text(source: string, tag: string) {
  const match = source.match(tagPattern(tag));
  return match ? decode(match[1].replace(/<[^>]+>/g, "")) : "";
}

function segment(source: string, tag: string) {
  return source.match(tagPattern(tag))?.[1] ?? "";
}

function segments(source: string, tag: string) {
  const pattern = tagPattern(tag, "gis");
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

function digits(value: string) { return value.replace(/\D/g, ""); }
function number(value: string) { const parsed = Number(value.replace(",", ".")); return Number.isFinite(parsed) ? parsed : 0; }
function optional(value: string) { const result = decode(value); return result || null; }
function date(value: string) {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) throw new Error("XML_DATE_INVALID");
  return match[1];
}

function funruralFromInformation(value: string) {
  if (!/FUNRURAL/i.test(value)) return { detected: false, rate: null, amount: null, source: null };
  const normalized = value.replace(/\s+/g, " ").trim();
  const rateMatch = normalized.match(/FUNRURAL[\s\S]{0,80}?(?:AL[IÍ]QUOTA(?:\s+DE)?|ALIQ(?:UOTA)?\.?)\s*[:=]?\s*(\d{1,2}(?:[.,]\d{1,4})?)/i);
  const amountMatch = normalized.match(/FUNRURAL[\s\S]{0,130}?(?:VALOR(?:\s+DE)?|VL\.?)\s*[:=]?\s*(?:R\$\s*)?([\d.]+(?:,\d{1,2})?|\d+(?:\.\d{1,2})?)/i);
  const decimal = (raw?: string) => raw ? Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw) : null;
  return { detected: true, rate: decimal(rateMatch?.[1]), amount: decimal(amountMatch?.[1]), source: normalized };
}

const transferCfops = new Set(["1151","1152","1153","1154","1155","1156","2151","2152","2153","2154","2155","2156","5151","5152","5153","5154","5155","5156","6151","6152","6153","6154","6155","6156"]);

export function classifyNfe(parsed: ParsedNfe, companyDocumentRoots = ["11034316"]): NfeClassification {
  const root = (document: string | null) => document?.length === 14 ? document.slice(0, 8) : document;
  const owned = (document: string | null) => Boolean(document && companyDocumentRoots.includes(root(document) || ""));
  const issuerOwned = owned(parsed.issuer.document), recipientOwned = owned(parsed.recipient.document);
  const cfops = parsed.items.map((item) => item.cfop).filter(Boolean);
  const transferEvidence = /TRANSFER/i.test(parsed.operationNature) || (cfops.length > 0 && cfops.every((cfop) => transferCfops.has(cfop)));
  const isReturn = parsed.fiscalPurpose === "4" || parsed.referencedAccessKeys.length > 0 && /DEVOLU/i.test(parsed.operationNature);

  if (issuerOwned && recipientOwned && transferEvidence) return { code: "TRANSFER", confidence: "CONFIRMED", reason: `Transferência entre estabelecimentos do grupo${cfops.length ? ` · CFOP ${cfops.join(", ")}` : ""}.`, counterparty: null };
  if (isReturn && recipientOwned && !issuerOwned) return { code: "SALE_RETURN", confidence: "CONFIRMED", reason: "Devolução recebida de cliente; Café BH é destinatária e a NF-e referencia a operação original.", counterparty: "ISSUER" };
  if (isReturn && issuerOwned && !recipientOwned) return { code: "PURCHASE_RETURN", confidence: "CONFIRMED", reason: "Devolução de compra emitida pela Café BH para o fornecedor.", counterparty: "RECIPIENT" };
  if (issuerOwned && parsed.operationType === "0") return { code: "PURCHASE", confidence: "CONFIRMED", reason: `NF-e própria de entrada · ${parsed.operationNature || "operação de compra"}${cfops.length ? ` · CFOP ${cfops.join(", ")}` : ""}.`, counterparty: "RECIPIENT" };
  if (recipientOwned && !issuerOwned) return { code: "PURCHASE", confidence: parsed.operationType === "1" ? "CONFIRMED" : "PROBABLE", reason: `Café BH é destinatária${cfops.length ? ` · CFOP ${cfops.join(", ")}` : ""}.`, counterparty: "ISSUER" };
  if (issuerOwned && parsed.operationType === "1") return { code: "SALE", confidence: "CONFIRMED", reason: `NF-e de saída emitida pela Café BH${cfops.length ? ` · CFOP ${cfops.join(", ")}` : ""}.`, counterparty: "RECIPIENT" };
  return { code: "REVIEW", confidence: "REVIEW", reason: "O CNPJ da Café BH não foi identificado de forma suficiente para classificar esta NF-e.", counterparty: null };
}

function party(source: string, addressTag: string): NfeParty {
  const address = segment(source, addressTag);
  return {
    name: text(source, "xNome") || "Não informado",
    tradeName: optional(text(source, "xFant")),
    document: optional(digits(text(source, "CNPJ") || text(source, "CPF"))),
    stateRegistration: optional(text(source, "IE")),
    address: {
      zipCode: optional(digits(text(address, "CEP"))),
      street: optional(text(address, "xLgr")),
      number: optional(text(address, "nro")),
      complement: optional(text(address, "xCpl")),
      district: optional(text(address, "xBairro")),
      city: optional(text(address, "xMun")),
      state: optional(text(address, "UF")),
      country: optional(text(address, "xPais")) || "BRASIL",
      phone: optional(digits(text(address, "fone"))),
    },
  };
}

function unitKilograms(unit: string, quantity: number) {
  const normalized = unit.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (["KG", "KGS", "KILO", "KILOS", "QUILOGRAMA", "QUILOGRAMAS"].includes(normalized)) return quantity;
  if (["SC", "SCS", "SACA", "SACAS", "SC60", "SACA60KG"].includes(normalized)) return quantity * 60;
  return null;
}

export function parseNfeXml(xml: string): ParsedNfe {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("XML_UNSAFE");
  const nfe = segment(xml, "NFe") || xml;
  const infMatch = nfe.match(/<(?:[\w-]+:)?infNFe\b([^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?infNFe>/i);
  if (!infMatch) throw new Error("XML_NFE_NOT_FOUND");
  const attributes = infMatch[1], inf = infMatch[2];
  const accessFromId = attributes.match(/\bId=["']NFe(\d{44})["']/i)?.[1];
  const accessKey = accessFromId || digits(text(xml, "chNFe"));
  if (!/^\d{44}$/.test(accessKey)) throw new Error("XML_ACCESS_KEY_INVALID");

  const ide = segment(inf, "ide");
  const issuerSource = segment(inf, "emit");
  const recipientSource = segment(inf, "dest");
  if (!issuerSource || !recipientSource) throw new Error("XML_PARTY_INVALID");

  const items = segments(inf, "det").map((det): NfeItem => {
    const product = segment(det, "prod");
    const quantity = number(text(product, "qCom"));
    const unit = text(product, "uCom");
    return {
      code: text(product, "cProd"),
      description: text(product, "xProd"),
      ncm: text(product, "NCM"),
      cfop: text(product, "CFOP"),
      unit,
      quantity,
      unitPrice: number(text(product, "vUnCom")),
      total: number(text(product, "vProd")),
      estimatedKilograms: unitKilograms(unit, quantity),
    };
  });

  const totalSource = segment(segment(inf, "total"), "ICMSTot");
  const estimatedKilograms = items.every((item) => item.estimatedKilograms !== null) && items.length
    ? items.reduce((sum, item) => sum + (item.estimatedKilograms ?? 0), 0)
    : null;
  const productsTotal = number(text(totalSource, "vProd"));
  const estimatedPricePerSack = estimatedKilograms && estimatedKilograms > 0
    ? productsTotal / (estimatedKilograms / 60)
    : null;
  const installments = segments(segment(inf, "cobr"), "dup").map((dup, index) => ({
    number: text(dup, "nDup") || String(index + 1),
    dueDate: date(text(dup, "dVenc")),
    amount: number(text(dup, "vDup")),
  })).filter((installment) => installment.amount > 0);
  const additionalInformation = optional(text(segment(inf, "infAdic"), "infCpl") || text(segment(inf, "infAdic"), "infAdFisco"));

  return {
    accessKey,
    number: text(ide, "nNF"),
    series: optional(text(ide, "serie")),
    issueDate: date(text(ide, "dhEmi") || text(ide, "dEmi")),
    issuer: party(issuerSource, "enderEmit"),
    recipient: party(recipientSource, "enderDest"),
    productsTotal,
    discount: number(text(totalSource, "vDesc")),
    freight: number(text(totalSource, "vFrete")),
    other: number(text(totalSource, "vOutro")),
    total: number(text(totalSource, "vNF")),
    estimatedKilograms,
    estimatedPricePerSack,
    items,
    installments,
    operationNature: text(ide, "natOp"),
    operationType: (["0", "1"].includes(text(ide, "tpNF")) ? text(ide, "tpNF") : null) as "0" | "1" | null,
    fiscalPurpose: optional(text(ide, "finNFe")),
    referencedAccessKeys: segments(ide, "refNFe").map((value) => digits(decode(value))).filter((value) => /^\d{44}$/.test(value)),
    additionalInformation,
    funrural: funruralFromInformation(additionalInformation || ""),
  };
}
