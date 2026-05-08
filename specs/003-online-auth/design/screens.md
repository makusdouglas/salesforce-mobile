# UI Design — Online-One-Time Authentication

**Source**: [layout.pen](../../../layout.pen)
**Captured**: 2026-04-20
**Feature**: 003-online-auth
**Design system**: **shadcn/ui (light theme)** — white background, neutral-zinc tokens, black primary button. Buttons por hierarquia: primary (preto, ação principal), outline/secondary (fundo cinza claro, ações paralelas), ghost (transparente, ações de saída/cancelar), destructive (vermelho, quando houver).

## Screens

| Screen | Viewport | Frame ID | Screenshot | Intent |
|--------|----------|----------|------------|--------|
| Login | Phone 390×844 | `nHzfG` | [login-phone.png](./login-phone.png) | Initial online login em fundo branco. Wordmark **SALESFORCE**, subtítulo "Entre para acessar sua conta.", card com borda fina, e-mail + senha, primary button preto "Entrar", rodapé "Precisa de acesso?". |
| Login | Tablet 820×1180 | `8C4hh` | [login-tablet.png](./login-tablet.png) | Mesmo contrato, card centralizado a 440 px, wordmark 30 px. |
| Relogin | Phone 390×844 | `BeFq2` | [relogin-phone.png](./relogin-phone.png) | Bottom-sheet modal (grip bar) sobre Home escurecida com `#0A0A0AB3`. Ícone `refresh-cw`, e-mail read-only em `#F4F4F5` com ícone `lock`, senha editável, primary button preto "Entrar e sincronizar", ghost "Cancelar". |
| Relogin | Tablet 820×1180 | `RnP3m` | [relogin-tablet.png](./relogin-tablet.png) | Dialog central a 460 px sobre Home escurecida. Mesma composição. |

## Tokens (shadcn light)

| Token | Valor | Uso |
|-------|-------|-----|
| `background` | `#FFFFFF` | Fundo de todas as telas e inputs/card |
| `foreground` | `#0A0A0A` | Texto principal (valores de input, wordmark) |
| `primary` | `#18181B` | Primary button fill, brand badge |
| `primary-foreground` | `#FAFAFA` | Texto do primary button |
| `muted` | `#F4F4F5` | Fundo do input read-only e do icon-badge do Relogin |
| `muted-foreground` | `#71717A` | Texto secundário, subtítulo, labels de ghost button, placeholders |
| `border` / `input` | `#E4E4E7` | Borda de card, borda de input, grip bar |
| `placeholder` | `#A1A1AA` | Placeholder de e-mail |
| `overlay` (modal) | `#0A0A0AB3` | Dim do Home por trás do Relogin |

## Components referenced (ad-hoc — a promover como reusables quando reutilizados)

- `BrandBadge` — frame 48/64 px, `fill primary`, `cornerRadius 10/14`, ícone `shopping-bag` (feather) em `primary-foreground`.
- `Card` — frame, `fill background`, `cornerRadius 12/16`, `stroke 1px border`, `padding 24/32`. Padrão shadcn card.
- `Input` — frame altura 40/44, `fill background`, `cornerRadius 8`, `stroke 1px border`, `padding horizontal 12/14`.
- `InputReadonly` — mesmo esqueleto do `Input`, porém sem borda e com `fill muted` + ícone `lock`.
- `ButtonPrimary` — altura 40/44/46, `fill primary`, `cornerRadius 8`, label Inter 14/15 500 `primary-foreground`.
- `ButtonGhost` — altura 40/42, sem fill, `cornerRadius 8`, label Inter 14 500 `muted-foreground`.

### Variantes de botão reservadas (não usadas nestas 4 telas, mas documentadas para ações futuras)

- `ButtonSecondary` — `fill muted`, texto `foreground`. Para ações paralelas de mesma importância (ex.: "Sincronizar antes de sair" num futuro diálogo de logout).
- `ButtonOutline` — `fill background`, `stroke 1px border`, texto `foreground`. Para ações neutras de menor peso.
- `ButtonDestructive` — `fill #EF4444` (shadcn destructive), texto `#FAFAFA`. Para "Sair" definitivo em futura tela de settings, ou "Apagar dados" se houver.

## Design decisions

- **shadcn/ui como base**: fundo branco, card com borda fina, cantos suaves, tipografia Inter inteira. Visual utilitário, denso e neutro — casa com o contexto B2B de campo (field sales) e com o mandato §3 "heavy UI libraries are forbidden" (shadcn são primitivas sem runtime pesado).
- **Feather como icon set** (em vez do Lucide default do shadcn): traço mais fino, mais legível em telas pequenas de campo, e **já disponível no `@expo/vector-icons`** que o Expo SDK 55 embute — não adiciona nova dependência e casa com o `expo-dev-client` do bloco 002.
- **Primary button preto, não accent**: segue a diretriz "primary preto". Accent de cor fica reservado para casos de destaque alto (ex.: sucesso de sincronização, alerta crítico). Em login e relogin não há necessidade — a única ação da tela já é hierarquicamente primária; cor é redundante.
- **Wordmark + subtítulo neutro**: **SALESFORCE** (Inter 22/30, weight 700, letter-spacing 2/3) dá feel de wordmark sem mudar família de fonte. Subtítulo *"Entre para acessar sua conta."* é deliberadamente genérico — a promessa do §7 D5 (90 dias offline) vive na spec/comportamento, não na tela, de modo que mudanças de messaging não forcem re-design.
- **Input read-only com `lock` + fill muted** (Relogin): diferencia visualmente do input editável da senha ao lado. Reforça §1 single-user-per-device (não dá para trocar conta aqui — logout primeiro).
- **Relogin phone = bottom-sheet / tablet = dialog central**: ambos preservam Home atrás por FR-008(a). O grip bar do phone comunica "modal dismissível"; o dialog do tablet usa borda em vez de grip (shadcn Alert Dialog). Em ambos, o dim `#0A0A0AB3` (≈70% opacity) atesta visualmente que Home continua lá.
- **CTA do Relogin = "Entrar e sincronizar"**: mapeia a ação ao resultado (FR-010 — re-login destrava `_queuedSync`). Não é só "Entrar" porque a spec diferencia os dois cenários.
- **Cancelar = ghost button**: `muted-foreground` em fundo transparente. Visualmente fraco de propósito — cancelar não é a ação desejada, mas a saída é legítima (FR-008c). Local data permanece (FR-008a), reforçado pelo body copy acima.
- **Sem "Remember me", "Forgot password", "Create account"**: constituição P4 (admin gerencia contas via Supabase dashboard) e escopo MVP lockam fora.

## Open questions for the spec

Nenhuma — as telas resolvem todos os pontos da spec.

## Implementation mapping (React Native)

- Fonte **Inter**: `expo-font` + arquivos TTF (Regular/Medium/SemiBold/Bold) em `src/assets/fonts/` (ou `@expo-google-fonts/inter`).
- Ícones **Feather**: usar o set `Feather` de `@expo/vector-icons` (já é transitivamente instalado pelo `expo`). Importação: `import { Feather } from '@expo/vector-icons';` → `<Feather name="eye" size={16} color={colors.mutedForeground} />`. Nomes usados nestas telas: `shopping-bag`, `eye`, `eye-off`, `refresh-cw`, `lock`.
- Tokens shadcn: implementar como objeto TS em `src/features/auth/theme/tokens.ts` (cores, espaçamentos, radii). Não introduz Tailwind / NativeWind nesta feature — valores hard-coded via StyleSheet seguem a ergonomia RN padrão e não puxam dependência nova (§P3 / §3 "heavy UI libraries are forbidden").
- Card / Input / Button: componentes locais em `src/features/auth/components/` reimplementando a aparência shadcn com `View` / `TextInput` / `Pressable`.
