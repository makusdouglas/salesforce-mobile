# Salesforce Mobile

App B2B offline-first para vendedores externos visitando pequenos varejistas.

Projeto dirigido por [spec-kit](https://github.com/github/spec-kit). Cada feature nasce como um bloco em [`SPECS.md`](./SPECS.md), ganha spec + plan + tasks + design, e só então vai para o código.

## Documentos primordiais

- [Constitution](./.specify/memory/constitution.md) — princípios invioláveis (offline-first, stack obrigatória, convenções)
- [SPECS.md](./SPECS.md) — backlog priorizado dos 13 blocos do MVP
- [Quickstart do scaffold](./specs/001-project-foundation/quickstart.md) — como rodar localmente em 10 min

## Comandos

```bash
pnpm install          # instala deps
pnpm start            # abre o Metro dev server
pnpm ios              # abre no simulator iOS
pnpm android          # abre no emulator Android
pnpm typecheck        # tsc strict
pnpm lint             # eslint
pnpm format:check     # prettier
pnpm build:dev        # EAS dev build
pnpm build:preview    # EAS internal preview
pnpm build:prod       # EAS production build
```

## Estrutura

```
src/
├── app/                 # composição app-level (navigation, providers, theme)
└── features/            # uma pasta por feature do produto
    ├── home/
    └── auth/
```

Identifiers em inglês. Copy da UI em português. Ver [constitution §9](./.specify/memory/constitution.md).

## Stack

Expo SDK 55 (managed) · TypeScript strict · React Navigation v7 · pnpm · EAS Build
