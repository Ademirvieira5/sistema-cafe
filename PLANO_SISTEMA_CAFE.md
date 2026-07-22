# Plano do Sistema Café

## Visão do produto

O Sistema Café será uma aplicação web profissional para controlar compras, vendas e a vida financeira de uma empresa que opera café físico. Deve substituir controles manuais espalhados em planilhas por um fluxo seguro, simples e integrado, funcionando bem no computador e no iPad.

A interface terá padrão premium de produto comercial: limpa, elegante, rápida, responsiva e fácil de usar diariamente.

## Princípios obrigatórios

- Interface e mensagens em português do Brasil.
- Valores monetários armazenados com precisão decimal exata.
- Datas exibidas no padrão `dd/mm/aaaa`.
- Quilos divididos por 60 geram sacas, inclusive fracionadas.
- Preços médios calculados por média ponderada.
- Registros financeiros aceitam baixas parciais e totais.
- Cadastros vinculados devem ser inativados, não apagados fisicamente.
- Alterações relevantes devem manter histórico.
- Nenhuma etapa seguinte deve ser antecipada sem autorização.
- Relatórios devem permitir visualização, impressão e PDF.

## Módulos planejados

### 1. Cadastros

- Fornecedores e clientes, pessoas físicas ou jurídicas.
- Corretores.
- Categorias financeiras, como aluguel, telefone, funcionários, impostos e empréstimos.
- Contas bancárias.
- Dados de CPF/CNPJ, endereço, contato e situação ativa/inativa.

### 2. Compras de café

Cada compra deve permitir:

- sequência ou número do lançamento;
- data;
- fornecedor;
- quantidade em quilos;
- cálculo automático de sacas por `quilos ÷ 60`;
- preço por saca;
- valor bruto;
- diferenças, descontos ou acréscimos editáveis;
- valor total final;
- corretor vinculado;
- comissão do corretor informada em percentual sobre o valor total ou diretamente em reais;
- um vencimento inicial com botão `Adicionar vencimento`, sem limite fixo;
- observações;
- histórico de alterações.

### 3. Pagamentos

- Uma parcela visível inicialmente.
- Botão `Adicionar parcela` para quantas forem necessárias.
- Edição de vencimento e valor.
- Baixa parcial ou total de cada parcela.
- Saldo individual por parcela e saldo geral da operação.
- Forma de pagamento, conta bancária, nominal e discriminação.
- Situações: aberto, parcial, pago, vencido e cancelado.

### 4. Vendas de café

Estrutura equivalente à compra, contendo cliente, quilos, sacas, preço unitário, valor total, ajustes, corretor, comissão e parcelas de recebimento.

### 5. Recebimentos

- Quatro parcelas iniciais e expansão conforme necessidade.
- Baixas parciais e totais.
- Conta bancária e forma de recebimento.
- Saldo por parcela e por venda.
- Histórico completo.

### 6. Corretores

- Ficha individual do corretor.
- Conferência com data e número do negócio, fornecedor ou cliente, sacas, preço por saca, valor total, percentual ou valor da comissão, valor pago, saldo e situação; sem coluna de vencimento.
- Comissão originada por compra ou venda.
- Lançamentos manuais permitidos quando necessários.
- Conta corrente de comissões.
- Baixas parciais e totais.
- Relatório de comissões abertas, pagas e vencidas.

### 7. Financeiro geral

- Contas a pagar e receber não ligadas ao café.
- Categorias de receitas e despesas.
- Movimentações bancárias de pagamento e recebimento por cheque, TED, PIX, débito e outras formas.
- Cada movimentação deve ser vinculada à conta bancária, à pessoa envolvida e, quando existir, à compra, venda, parcela ou conta que originou o valor.
- Registrar data do lançamento, data da movimentação/compensação, valor, tipo, nominal/favorecido, discriminação e documento.
- Para cheques, registrar banco, número do cheque, nominal, emissão, vencimento e situação: aberto, emitido, recebido, compensado, devolvido ou cancelado.
- Para TED e PIX, registrar favorecido/pagador, documento ou referência e data da confirmação.
- Pagamentos e recebimentos bancários devem gerar a baixa correspondente, inclusive parcial, sem duplicar o valor no fluxo financeiro.
- As movimentações confirmadas atualizam o saldo realizado do banco; as futuras ou ainda abertas alimentam o saldo projetado diário.
- Campos de nominal e discriminação.
- Vínculo obrigatório com conta bancária quando aplicável.
- Conciliação diária com o extrato bancário.
- Manutenção dos lançamentos ainda abertos.
- Saldo por banco.
- Fluxo financeiro projetado por dia, começando pelo saldo bancário inicial de cada data.
- Para cada dia, demonstrar separadamente entradas previstas, saídas previstas e saldo final projetado.
- O saldo final de um dia deve alimentar automaticamente o saldo inicial do dia seguinte.
- Permitir abrir cada dia para conferir os lançamentos que formam entradas e saídas.
- Permitir filtrar por período e por conta bancária, além de consolidar todas as contas.
- Disponibilizar visualização profissional pronta para impressão, exportação em PDF e compartilhamento com o comprador.
- O relatório enviado deve mostrar data, saldo inicial, total de entradas, total de saídas e saldo final, com totais do período.

### 8. Relatórios

- Compras por período, fornecedor, quantidade, preço unitário e valor total.
- Vendas por período, cliente, quantidade, preço unitário e valor total.
- Relatório mensal de compras e vendas, incluindo operações com documento fiscal e sem documento, com identificação clara da situação documental.
- Resumo mensal com quantidades, quilos, sacas e preços médios ponderados de compra e venda.
- Apuração do lucro bruto geral do mês pela fórmula: receita das vendas menos CMV do café efetivamente vendido.
- O CMV deve usar o custo médio ponderado do estoque; não calcular lucro bruto simplesmente subtraindo as compras do mês das vendas do mês.
- Demonstrar receita bruta, quantidade vendida, custo médio, CMV, lucro bruto em reais e margem bruta percentual.
- Permitir detalhar o resultado por lançamento e consolidar operações com e sem documento.
- Relatório diário de compras de café a pagar.
- Relatório diário de vendas de café a receber.
- Cada relatório deve mostrar número do negócio, data, fornecedor ou cliente, quilos, sacas, preço por saca, valor total, parcelas, valores já baixados e saldo em aberto.
- No relatório “A pagar”, reunir compras de café e despesas/contas gerais, identificando a origem de cada linha.
- No relatório “A receber”, reunir vendas de café e outras receitas/contas a receber, identificando a origem de cada linha.
- Permitir visualizar tudo consolidado ou filtrar somente café, despesas, vendas ou outras receitas.
- Os relatórios devem permitir filtro por período, vencimento, fornecedor ou cliente e situação.
- Exibir totais de quilos, sacas, valor original, valor baixado e saldo aberto ao final.
- Preparar os dois relatórios especialmente para visualização e impressão diária, além da exportação em PDF.
- Contas a pagar e receber de outras finalidades.
- Parcelas abertas, parciais, pagas e vencidas.
- Comissões de corretores.
- Movimentação e saldo das contas bancárias.
- Fluxo financeiro diário, com saldo inicial, entradas, saídas, saldo final e relatório próprio para envio ao comprador.
- Visualização antes da impressão e exportação em PDF.

### 9. Importação de NF-e por XML

Etapa futura:

- importar XML individual ou arquivo ZIP;
- preservar o XML original;
- impedir importação duplicada pela chave da NF-e;
- ler número, série, datas, chave, emitente, destinatário, CPF/CNPJ, CFOP, produtos, unidade, quantidade, peso, valores, frete, descontos, tributos, natureza da operação e notas referenciadas;
- classificar compra, venda, devolução de compra ou devolução de venda;
- exigir tela de conferência antes de gerar lançamentos;
- ligar devoluções à nota original;
- permitir percentual configurável de Funrural, começando com referência de 1,63%.

## Experiência visual

- Tela inicial limpa com indicadores essenciais, atalhos e pendências.
- Navegação lateral com módulos bem separados.
- Cadastros e lançamentos em telas próprias, modais ou painéis laterais.
- Tabelas profissionais com pesquisa, filtros, ordenação, paginação e ações claras.
- Formulários divididos em seções lógicas.
- Confirmação antes de ações sensíveis.
- Estados de carregamento, vazio, erro e sucesso.
- Layout responsivo para computador e iPad.
- Aparência premium sem sacrificar velocidade ou legibilidade.
- Direção visual escolhida: tema escuro sofisticado, grafite profundo, verde-esmeralda e cobre.
- O fluxo financeiro diário deve ter destaque central na tela inicial, com leitura rápida do saldo por dia.
- Os atalhos “Compras a pagar” e “Vendas a receber” devem ficar acessíveis na tela inicial por serem usados e impressos diariamente.

## Ordem oficial de implementação

1. Planejamento
2. Banco de dados
3. Cadastros
4. Compras
5. Pagamentos
6. Vendas
7. Recebimentos
8. Corretores
9. Financeiro
10. Relatórios
11. Importação de XML

## Etapa 1 autorizada

A primeira entrega funcional será limitada a:

- estrutura inicial da aplicação;
- banco de dados e migrações;
- cadastro de fornecedores e clientes;
- cadastro de corretores;
- cadastro de categorias financeiras;
- cadastro de contas bancárias;
- testes desse escopo.

Compras, vendas, pagamentos, recebimentos, financeiro, relatórios e XML não devem ser implementados nesta etapa.

## Critérios de conclusão da Etapa 1

- Aplicação abre sem erros.
- Interface segue o padrão premium e responsivo.
- Banco de dados pode ser criado do zero por migrações.
- Cadastros podem ser incluídos, consultados, editados e inativados.
- Validações e duplicidades relevantes são tratadas.
- Testes automatizados do escopo passam.
- Arquivos alterados e resultados dos testes são informados ao usuário.
