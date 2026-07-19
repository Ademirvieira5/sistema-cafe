# Sistema de Compras, Vendas e Controle Financeiro de Café

## Fonte de verdade

- Antes de analisar, planejar ou programar, leia integralmente o arquivo `PLANO_SISTEMA_CAFE.md`.
- Trate esse arquivo como a fonte principal dos requisitos funcionais e das regras de negócio.
- Se o plano não estiver disponível, pare e solicite o arquivo. Não invente requisitos para substituí-lo.
- Leia também todos os arquivos de instruções aplicáveis nas pastas do projeto.

## Preservação do projeto

- Inspecione toda a estrutura existente antes de editar arquivos.
- Não apague, substitua ou prejudique funcionalidades que já estejam funcionando.
- Preserve alterações existentes do usuário, inclusive em uma árvore de trabalho não limpa.
- Antes de alterações grandes, faça um commit de segurança quando o projeto estiver em git, ou gere um backup claro dos arquivos afetados quando não houver git utilizável.
- Faça mudanças pequenas, rastreáveis e compatíveis com a arquitetura já adotada.
- Antes de alterar banco de dados ou dados persistidos, identifique o mecanismo de migrações e mantenha compatibilidade com os dados existentes.

## Forma de implementação

- Não tente construir o sistema inteiro de uma única vez.
- Divida o desenvolvimento em etapas verificáveis.
- Antes de cada etapa, registre escopo, dependências, critérios de aceite e testes previstos.
- Ao concluir uma etapa, execute os testes relevantes, informe os arquivos criados ou alterados e aguarde nova instrução antes de avançar.
- Não implemente funcionalidades de etapas futuras apenas por conveniência.

## Análise obrigatória antes da programação

Antes da primeira alteração funcional:

1. Leia integralmente `PLANO_SISTEMA_CAFE.md`.
2. Faça o inventário dos arquivos e das funcionalidades existentes.
3. Identifique a tecnologia, a arquitetura, o banco de dados e o sistema de testes já utilizados.
4. Proponha um plano de implementação por etapas.
5. Defina a estrutura do banco de dados, incluindo entidades, relacionamentos, restrições, índices e estratégia de migrações.
6. Defina as telas, janelas, modais, fluxos de navegação e relatórios.
7. Registre dúvidas, conflitos, riscos e melhorias recomendadas.
8. Confirme que o trabalho atual está limitado à etapa autorizada.

## Etapa 1 autorizada

A primeira etapa deve conter somente:

- estrutura inicial do projeto;
- banco de dados e migrações iniciais;
- cadastro de fornecedores e clientes;
- cadastro de corretores;
- cadastro de categorias financeiras;
- cadastro de contas bancárias;
- testes correspondentes a esse escopo.

Ao terminar a Etapa 1, pare e aguarde nova instrução.

## Interface

- Mantenha a tela inicial limpa e objetiva.
- Abra cadastros e lançamentos em páginas próprias, janelas próprias ou modais adequados.
- Não concentre todos os campos do sistema na tela inicial.
- Use linguagem em português do Brasil e formatação brasileira para datas, números, CPF/CNPJ e valores monetários.
- Exiba mensagens de validação compreensíveis para o usuário.
- Considere uso em computador e tablet, com navegação simples e campos confortáveis para toque.

## Parcelas de pagamentos e recebimentos

- Apresente inicialmente quatro linhas para parcelas.
- Disponibilize o botão `Adicionar parcela` para criar novas linhas conforme a necessidade.
- Não imponha limite fixo de quatro parcelas no banco de dados.
- Esse comportamento deve ser mantido quando os módulos de pagamentos e recebimentos forem autorizados em etapa futura.

## Dados e regras gerais

- Use valores monetários e quantidades com tipos decimais exatos; não use ponto flutuante para dinheiro.
- Nunca use número decimal comum ou ponto flutuante binário para dinheiro; use `Decimal`, inteiro em centavos, `NUMERIC/DECIMAL` no banco, ou equivalente exato da tecnologia adotada.
- Quilos divididos por 60 geram a quantidade de sacas.
- Permita quantidade fracionada de sacas.
- Use média ponderada para cálculos de preços médios.
- Pagamentos e recebimentos devem aceitar baixas parciais.
- Mantenha histórico e integridade referencial dos registros financeiros.
- Mantenha histórico de inclusões, alterações e exclusões, com data/hora e usuário quando houver autenticação.
- Prefira inativação a exclusão física de cadastros já vinculados a operações.
- Valide duplicidades relevantes, especialmente CPF/CNPJ e dados bancários, sem bloquear situações legítimas previstas no plano.
- Alterações de esquema devem ser feitas por migrações reproduzíveis.
- Credenciais e segredos nunca devem ser gravados no código-fonte.

## Relatórios

- Relatórios devem permitir visualização antes da impressão.
- Relatórios devem permitir impressão ou exportação em PDF.
- A apresentação dos relatórios deve usar português do Brasil e formatação brasileira para datas, números, sacas e valores monetários.

## Qualidade e verificação

- Siga os padrões e comandos existentes no projeto.
- Crie testes automatizados para regras de negócio, validações, persistência e rotas ou componentes críticos.
- Execute testes, análise estática e compilação disponíveis antes de concluir a etapa.
- Não declare sucesso sem informar os comandos executados e seus resultados.
- Se algum teste não puder ser executado, explique claramente o motivo.

## Entrega de cada etapa

O resumo final deve informar:

- o que foi implementado;
- o que foi deliberadamente deixado para etapas futuras;
- os arquivos criados e alterados;
- as migrações ou mudanças no banco;
- os testes executados e resultados;
- dúvidas ou decisões que ainda dependem do usuário.
