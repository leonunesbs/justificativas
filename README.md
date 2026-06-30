# JustOFT

Gerador de **justificativas de cirurgias** do Serviço de Oftalmologia do HGF. Cadastre as justificativas, salve as informações do médico e gere os PDFs prontos para impressão. Os dados ficam no `localStorage` e podem ser exportados/importados em JSON.

Há ainda **busca automática no FastMedic**: informe o número da solicitação (campo "Número do FASTMEDIC") e o app preenche nome, cirurgia e justificativa. Essa busca usa uma rota server-side (`/api/fastmedic`) que autentica no FastMedic Ceará — portanto o app roda com servidor Node (`next start` / deploy), não como export estático. A busca é liberada **apenas para usuários com conta e assinatura ativa** (via Clerk); o restante do app continua gratuito e offline.

## Stack

- ⚡️ **Next.js 16** (App Router + Turbopack)
- ⚛️ **React 19** com React Compiler
- ⛑ **TypeScript 6** (modo estrito)
- 🎨 **Tailwind CSS 4** + **shadcn/ui** (estilo new-york)
- 🧾 **react-hook-form** + **zod 4** para formulários e validação
- 📄 **pdf-lib** para gerar os PDFs a partir de `public/modelo.pdf`
- 🔔 **sonner** para notificações
- 🔐 **Clerk** para contas e assinatura (gateia a busca no FastMedic)
- 🧹 **oxlint** + **oxfmt** (toolchain Oxc) para lint e formatação
- 🐶 **Husky** + **Commitlint** + **lint-staged**

## Requisitos

- Node.js >= 20.9 (veja [`.nvmrc`](.nvmrc) → 24)
- pnpm 10
- Conta no [Clerk](https://dashboard.clerk.com) com **Billing** habilitado (para a busca no FastMedic)

## Configuração

Copie `.env.example` para `.env.local` e preencha as chaves do Clerk:

```bash
cp .env.example .env.local
```

| Variável                            | Obrigatória | Descrição                                                     |
| ----------------------------------- | ----------- | ------------------------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | sim         | Chave pública do Clerk (Dashboard → API keys).                |
| `CLERK_SECRET_KEY`                  | sim         | Chave secreta do Clerk.                                       |
| `NEXT_PUBLIC_CLERK_PLAN_SLUG`       | não         | Slug do plano que libera a busca no FastMedic (padrão `pro`). |

No **Clerk Dashboard**: habilite o **Billing** e crie um plano com o slug acima
(`pro` por padrão). Só quem assinar esse plano consegue usar a busca no FastMedic.

> As credenciais do FastMedic (CPF/senha) **não** ficam em variáveis de ambiente:
> são digitadas no próprio app e guardadas apenas no `localStorage` do navegador.

## Começando

```bash
pnpm install
pnpm dev
```

Abra `http://localhost:3000`.

## Scripts

- `pnpm dev` — ambiente de desenvolvimento em `http://localhost:3000`.
- `pnpm build` — build de produção otimizado.
- `pnpm start` — sobe o build de produção.
- `pnpm type-check` — gera os tipos de rota (`next typegen`) e roda o `tsc`.
- `pnpm lint` / `pnpm lint:fix` — oxlint (com checagem type-aware).
- `pnpm format` / `pnpm format:check` — oxfmt.

## Busca no FastMedic

1. Faça login (botão **Entrar**) e tenha uma assinatura ativa do plano configurado.
2. No card **Acesso FastMedic**, informe CPF e senha (ficam só no navegador).
3. Digite o número da solicitação e pressione **Enter** (ou **Buscar** / `Ctrl+B`).

A rota `/api/fastmedic` faz o login no FastMedic Ceará e devolve os eventos do
fluxo em **NDJSON (streaming)** — por isso o status da autenticação aparece ao
vivo. Os campos Nome, Cirurgia, Justificativa e Tipo são preenchidos a partir
da resposta. A rota exige usuário autenticado **e** com assinatura ativa.

## Atalhos de teclado

Otimizados para Windows + Chrome (todos interceptáveis pelo navegador); no macOS,
`Ctrl` também responde a `⌘`. Pressione `?` no app para ver a lista. O Número do
FASTMEDIC recebe foco ao abrir e após adicionar; **Enter** nele dispara a busca.

| Atalho         | Ação                                |
| -------------- | ----------------------------------- |
| `Ctrl+Enter`   | Adicionar / Atualizar justificativa |
| `Ctrl+B`       | Buscar dados no FastMedic           |
| `Ctrl+Shift+F` | Focar Número do FASTMEDIC           |
| `Ctrl+Shift+P` | Focar Nome do Paciente              |
| `Ctrl+Shift+G` | Focar Proposta de Cirurgia          |
| `Ctrl+Shift+U` | Focar Justificativa                 |
| `Ctrl+O`       | Importar JSON                       |
| `Ctrl+S`       | Exportar JSON                       |
| `Ctrl+P`       | Imprimir Tudo (PDF)                 |
| `Esc`          | Cancelar edição / fechar ajuda      |
| `?`            | Mostrar atalhos                     |

## Banner de novidades

`src/components/news-banner.tsx` exibe um banner de novidades 100% client-side.
Ao dispensar, a versão atual fica no `localStorage`; o banner só reaparece quando
a versão muda. Para **lançar um banner novo**, suba o campo `version` (e atualize
os `highlights`) — ele volta a aparecer para todos. Sem servidor.

## Estrutura

```
src/
├── app/
│   ├── api/fastmedic/      # rota server: login + busca (NDJSON streaming)
│   ├── assinatura/         # planos (Clerk PricingTable)
│   ├── sign-in/, sign-up/  # páginas de autenticação (Clerk)
│   ├── layout.tsx          # ClerkProvider + controles de login
│   └── page.tsx            # app principal (justificativas)
├── components/
│   ├── ui/                 # componentes shadcn/ui (Tailwind 4)
│   └── news-banner.tsx     # banner de novidades versionado (client-side)
├── hooks/                  # use-hotkeys, use-local-storage
├── lib/
│   ├── billing.ts          # slug do plano exigido (Clerk Billing)
│   ├── fastmedic.ts        # parsing/mapeamento da resposta do FastMedic
│   └── utils.ts            # cn() + geração de PDF com pdf-lib
├── proxy.ts                # clerkMiddleware (auth — convenção do Next 16)
public/modelo.pdf           # template usado nas justificativas
```

O alias `@/*` aponta para `src/*` (ex.: `import { Button } from '@/components/ui/button'`).

## Licença

[MIT](LICENSE.md).
