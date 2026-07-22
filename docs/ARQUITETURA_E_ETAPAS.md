# Arquitetura e plano de implementação

## Inventário inicial

Antes da Etapa 1, o repositório continha apenas `AGENTS.md`, `PLANO_SISTEMA_CAFE.md`, um `README.md` mínimo e um HTML salvo de uma conversa. Não existiam aplicação, banco, dependências ou testes a preservar.

## Tecnologia adotada

- Next.js e React com TypeScript para uma aplicação web responsiva.
- Rotas internas HTTP para separar interface e persistência.
- Prisma como camada de acesso ao banco e migrações reproduzíveis.
- SQLite no desenvolvimento inicial. Antes da implantação multiusuário, a mesma modelagem deverá migrar para PostgreSQL.
- Zod para validações e normalização de dados.
- Vitest para testes automatizados.

## Etapas

1. **Fundação e cadastros:** estrutura, banco, fornecedores/clientes, corretores, categorias e contas bancárias.
2. **Compras:** negócios, quilos, sacas, valores, ajustes, documento fiscal e corretor.
3. **Pagamentos:** parcelas ilimitadas com quatro linhas iniciais, baixas parciais e saldos.
4. **Vendas:** negócios de venda e vínculo com estoque/custo.
5. **Recebimentos:** parcelas, baixas e saldos a receber.
6. **Conta de corretores:** comissões de compras e vendas, lançamentos e baixas.
7. **Financeiro e bancos:** contas gerais, movimentos, cheques, PIX, TED, conciliação e fluxo diário.
8. **Relatórios:** operacionais, mensais, CMV, lucro bruto, impressão e PDF.
9. **XML:** importação, conferência, deduplicação e vínculo de NF-e/devoluções.

As etapas 2 a 9 são somente planejamento e não foram implementadas nesta entrega.

## Banco de dados planejado

### Entidades da Etapa 1

- `Person`: pessoa física/jurídica, documento, endereço, contato e situação.
- `PersonRole`: permite que a mesma pessoa seja fornecedora, cliente ou ambas.
- `Broker`: ficha do corretor e dados de contato/pagamento.
- `FinancialCategory`: classificação como receita, despesa ou ambas.
- `BankAccount`: banco, agência, conta, tipo e saldo inicial decimal.
- `AuditLog`: histórico de inclusão, edição, inativação e reativação.

### Entidades previstas para as próximas etapas

- `Purchase`, `PurchaseAdjustment`, `PayableInstallment`, `Payment`.
- `Sale`, `SaleAdjustment`, `ReceivableInstallment`, `Receipt`.
- `BrokerCommission`, `BrokerCommissionSettlement`.
- `GeneralPayable`, `GeneralReceivable`, `BankTransaction`, `Check`.
- `InventoryMovement`, `InventoryAverageCost`.
- `FiscalDocument`, `FiscalDocumentItem`, `XmlImport`.

Todos os valores monetários usarão `DECIMAL/NUMERIC`. Quilos, sacas, preços e percentuais também terão escala decimal explícita. As relações financeiras usarão chaves estrangeiras e inativação em vez de exclusão física.

## Telas, modais e relatórios

### Etapa 1

- Visão geral limpa, com atalhos para os cadastros.
- Página de fornecedores/clientes com pesquisa, filtro, tabela e formulário lateral.
- Página de corretores com pesquisa, filtro, tabela e formulário lateral.
- Página de categorias financeiras com pesquisa, filtro, tabela e formulário lateral.
- Página de contas bancárias com pesquisa, filtro, tabela e formulário lateral.
- Confirmação visual de sucesso, mensagens de erro, estados vazios e carregamento.

### Futuro autorizado somente em etapas próprias

- Compras, vendas e baixas em páginas ou painéis próprios.
- Parcelas com quatro linhas iniciais e botão `Adicionar parcela`, sem limite no banco.
- Fluxo financeiro diário central na visão geral.
- Relatórios de compras, vendas, a pagar, a receber, bancos, comissões, CMV e lucro bruto, todos com pré-visualização e PDF.
- Conferência de XML antes de criar qualquer lançamento.

## Decisões, riscos e melhorias

- **Autenticação:** não foi incluída no plano da Etapa 1. O histórico já existe, mas o usuário responsável só poderá ser gravado após a definição de acesso e perfis.
- **Banco de produção:** SQLite atende desenvolvimento e testes locais. Para uso simultâneo entre computadores, recomenda-se PostgreSQL gerenciado.
- **Endereço por CEP:** a consulta automática pode ser adicionada depois, sem alterar a modelagem atual.
- **CPF/CNPJ compartilhado:** a base evita duplicar uma mesma pessoa como fornecedor e cliente por meio dos papéis múltiplos.
- **Saldo inicial:** é decimal exato e será a origem do fluxo por conta quando o financeiro for implementado.
- **HTML salvo:** foi preservado por pertencer ao histórico anterior, embora não faça parte da aplicação.

