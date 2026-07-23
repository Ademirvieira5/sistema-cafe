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

## Abrir no Windows sem tela preta

Depois da instalação inicial e da atualização pelo GitHub Desktop:

1. Abra a pasta do projeto.
2. Dê dois cliques em `INICIAR_SISTEMA_CAFE.vbs`.
3. Aguarde alguns segundos; o navegador abrirá sozinho em `http://localhost:3000`.
4. Para desligar o sistema, dê dois cliques em `FECHAR_SISTEMA_CAFE.vbs`.

O inicializador trabalha escondido, cria o arquivo `.env` se ele ainda não existir, atualiza o banco e inicia o sistema sem manter uma janela preta visível.

Opcionalmente, crie atalhos desses dois arquivos na Área de Trabalho.

## Como executar manualmente

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
