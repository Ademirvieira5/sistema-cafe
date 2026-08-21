export type FieldOption = { value: string; label: string };

export type FieldConfig = {
  name: string;
  label: string;
  type?: "text" | "email" | "date" | "textarea" | "select" | "money" | "checkboxes";
  placeholder?: string;
  required?: boolean;
  options?: FieldOption[];
  full?: boolean;
  maxLength?: number;
  readOnly?: boolean;
};

export type ModuleConfig = {
  slug: "pessoas" | "corretores" | "categorias" | "contas";
  title: string;
  singular: string;
  description: string;
  eyebrow: string;
  sections: { title: string; description?: string; fields: FieldConfig[] }[];
};

const personType: FieldOption[] = [
  { value: "PF", label: "Pessoa física" },
  { value: "PJ", label: "Pessoa jurídica" },
];

export const moduleConfigs: Record<string, ModuleConfig> = {
  pessoas: {
    slug: "pessoas",
    title: "Pessoas e empresas",
    singular: "pessoa ou empresa",
    description: "Cadastro geral sem duplicidade, preparado para compras, vendas, depósitos e futuras importações fiscais.",
    eyebrow: "Relacionamentos",
    sections: [
      {
        title: "Classificação e identificação",
        description: "Cada CPF ou CNPJ possui um único cadastro e pode exercer mais de um papel.",
        fields: [
          { name: "roles", label: "Relacionamento", type: "checkboxes", required: true, options: [{ value: "SUPPLIER", label: "Fornecedor" }, { value: "CUSTOMER", label: "Cliente" }, { value: "BROKER", label: "Corretor" }, { value: "DEPOSITOR", label: "Depositante" }, { value: "WAREHOUSE", label: "Armazém geral" }], full: true },
          { name: "personType", label: "Tipo de pessoa", type: "select", required: true, options: personType },
          { name: "classification", label: "Classificação", type: "select", required: true, options: [{ value: "COMPANY", label: "Firma / empresa" }, { value: "RURAL_PRODUCER", label: "Produtor rural" }, { value: "INDIVIDUAL", label: "Pessoa física" }, { value: "OTHER", label: "Outra" }] },
          { name: "legalName", label: "Nome / razão social", required: true, placeholder: "Nome completo ou razão social" },
          { name: "tradeName", label: "Nome fantasia", placeholder: "Como é conhecido" },
          { name: "cpfCnpj", label: "CPF / CNPJ", placeholder: "Somente números ou formatado" },
          { name: "rgIe", label: "RG / inscrição estadual" },
        ],
      },
      {
        title: "Contato",
        fields: [
          { name: "phone", label: "Telefone / WhatsApp", placeholder: "(00) 00000-0000" },
          { name: "email", label: "E-mail", type: "email", placeholder: "contato@empresa.com.br" },
        ],
      },
      {
        title: "Endereço",
        fields: [
          { name: "zipCode", label: "CEP", placeholder: "00000-000" },
          { name: "street", label: "Logradouro" },
          { name: "number", label: "Número" },
          { name: "complement", label: "Complemento" },
          { name: "district", label: "Bairro" },
          { name: "city", label: "Cidade" },
          { name: "state", label: "UF", maxLength: 2 },
          { name: "country", label: "País" },
        ],
      },
      {
        title: "Tratamento fiscal",
        description: "O Funrural fica sinalizado para conferência; nenhuma retenção será feita sem a regra fiscal da operação.",
        fields: [
          { name: "funruralStatus", label: "Funrural", type: "select", required: true, options: [{ value: "REVIEW", label: "Conferir na NF-e" }, { value: "WITHHOLD", label: "Reter no pagamento" }, { value: "EXEMPT", label: "Isento / dispensado" }, { value: "NOT_APPLICABLE", label: "Não se aplica" }] },
          { name: "lastInvoiceAt", label: "Última NF-e localizada", type: "date", readOnly: true },
          { name: "source", label: "Origem do cadastro", readOnly: true },
          { name: "lastImportedAt", label: "Última atualização importada", readOnly: true },
        ],
      },
      { title: "Observações", fields: [{ name: "notes", label: "Observações internas", type: "textarea", full: true }] },
    ],
  },
  corretores: {
    slug: "corretores",
    title: "Corretores",
    singular: "corretor",
    description: "Cadastre os profissionais que intermediam as operações de café.",
    eyebrow: "Intermediação",
    sections: [
      {
        title: "Identificação",
        fields: [
          { name: "personType", label: "Tipo de pessoa", type: "select", required: true, options: personType },
          { name: "name", label: "Nome / razão social", required: true },
          { name: "tradeName", label: "Nome fantasia" },
          { name: "cpfCnpj", label: "CPF / CNPJ" },
          { name: "rgIe", label: "RG / inscrição estadual" },
        ],
      },
      {
        title: "Contato e pagamento",
        fields: [
          { name: "phone", label: "Telefone / WhatsApp" },
          { name: "email", label: "E-mail", type: "email" },
          { name: "pixKey", label: "Chave PIX", full: true },
        ],
      },
      { title: "Observações", fields: [{ name: "notes", label: "Observações internas", type: "textarea", full: true }] },
    ],
  },
  categorias: {
    slug: "categorias",
    title: "Categorias financeiras",
    singular: "categoria",
    description: "Organize receitas e despesas para os controles e relatórios financeiros.",
    eyebrow: "Classificação",
    sections: [
      {
        title: "Dados da categoria",
        fields: [
          { name: "code", label: "Código", placeholder: "Ex.: ALUGUEL" },
          { name: "name", label: "Nome da categoria", required: true, placeholder: "Ex.: Aluguel" },
          { name: "type", label: "Natureza", type: "select", required: true, options: [{ value: "EXPENSE", label: "Despesa" }, { value: "INCOME", label: "Receita" }, { value: "BOTH", label: "Receita e despesa" }] },
          { name: "description", label: "Descrição", type: "textarea", full: true },
        ],
      },
    ],
  },
  contas: {
    slug: "contas",
    title: "Contas bancárias",
    singular: "conta bancária",
    description: "Contas que receberão lançamentos, conciliação e fluxo financeiro nas próximas etapas.",
    eyebrow: "Tesouraria",
    sections: [
      {
        title: "Identificação da conta",
        fields: [
          { name: "bankCode", label: "Código do banco", placeholder: "Ex.: 001" },
          { name: "bankName", label: "Banco", required: true, placeholder: "Nome da instituição" },
          { name: "agency", label: "Agência" },
          { name: "accountNumber", label: "Número da conta", required: true },
          { name: "accountDigit", label: "Dígito" },
          { name: "type", label: "Tipo de conta", type: "select", required: true, options: [{ value: "CHECKING", label: "Conta corrente" }, { value: "SAVINGS", label: "Poupança" }, { value: "INVESTMENT", label: "Investimento" }, { value: "CASH", label: "Caixa" }] },
          { name: "description", label: "Apelido / descrição", placeholder: "Ex.: Conta principal" },
          { name: "openingBalance", label: "Saldo inicial", type: "money", required: true, placeholder: "0,00" },
        ],
      },
    ],
  },
};

export function defaultValues(config: ModuleConfig) {
  const values: Record<string, string | boolean | string[]> = { active: true };
  for (const section of config.sections) {
    for (const field of section.fields) {
      if (field.type === "checkboxes") values[field.name] = [];
      else if (field.name === "personType") values[field.name] = "PF";
      else if (field.name === "classification") values[field.name] = "INDIVIDUAL";
      else if (field.name === "country") values[field.name] = "BRASIL";
      else if (field.name === "funruralStatus") values[field.name] = "REVIEW";
      else if (field.name === "source") values[field.name] = "Cadastro manual";
      else if (field.name === "type" && config.slug === "categorias") values[field.name] = "EXPENSE";
      else if (field.name === "type" && config.slug === "contas") values[field.name] = "CHECKING";
      else if (field.name === "openingBalance") values[field.name] = "0,00";
      else values[field.name] = "";
    }
  }
  return values;
}

