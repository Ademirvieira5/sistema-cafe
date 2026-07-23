# Sistema Café BH

Aplicação web para compras, vendas e controle financeiro de uma empresa que opera café físico.

## Escopo atual

A Etapa 1 implementa os cadastros e a Etapa 2 acrescenta:

- fornecedores e clientes em uma base única;
- corretores;
- categorias financeiras;
- contas bancárias;
- inativação sem exclusão física;
- histórico de alterações;
- interface responsiva para computador e iPad.
- negócios de café com seleção de compra ou venda e cálculo automático de sacas e valores;
- um vencimento inicial e botão para adicionar quantos forem necessários;
- comissão do corretor em percentual ou valor em reais;
- ficha de conferência do corretor com sacas e preço unitário.
- relatórios separados de compras e vendas com preço médio ponderado;
- mapa diário consolidado de contas a pagar e receber, com saldo diário, acumulado, filtros e impressão.

Baixas de pagamentos e comissões, vendas, recebimentos, financeiro, relatórios gerais e XML permanecem para as próximas etapas.

## Como executar

Requisitos: Node.js 20 ou superior.

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:deploy
npm run dev
```

Abra `http://localhost:3000`.

## Verificação

```bash
npm test
npm run lint
npm run build
```

O detalhamento das decisões está em `docs/ARQUITETURA_E_ETAPAS.md`.
