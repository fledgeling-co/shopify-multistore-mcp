# shopify-multi-mcp — design system

Mined from the icon (`design/icon/icon.svg`): a porcelain ground carrying one jade gel family, and from the subject's own world — shopfront awnings, shop signage and the labels on a key rack. Taken: porcelain, jade, signage-width type, store names set as labels. Left: Shopify's bag green (#95BF47) and anything that reads as an official Shopify surface.

## Colour

| Token | Light | Dark | Role |
|---|---|---|---|
| `--porcelain` | `#F6F6F3` | `#111614` | page ground |
| `--surface` | `#FFFFFF` | `#18201D` | cards, chat panels |
| `--ink` | `#14211C` | `#ECF2EF` | headings and body |
| `--ink-2` | `#4E5A55` | `#A5B2AC` | secondary text (6.65:1 on porcelain; 8.33:1 dark) |
| `--line` | `#E1E4E0` | `#27312D` | rules and borders |
| `--jade` | `#1CB884` | `#2FD39A` | fills, store dots, the signature colour; never text on porcelain |
| `--jade-deep` | `#0A6F5C` | `#58E0B0` | links, small accent text, primary button ground (5.6:1 on porcelain; white on it 6.1:1) |
| `--mint` | `#DDF3E9` | `#1D3A31` | store-label chips, selected rows |
| `--warn` | `#9A5B12` | `#D9A05B` | conditional evidence |
| `--veto` | `#A33224` | `#E0705F` | refusals, eliminated options |

Strategy: restrained. Neutrals carry most of any screen; jade appears in at most two places per screen besides the store labels.

## Type

- **Archivo** (variable, width axis) for everything set in sentences. Display at width 112–118 and weight 700 reads as shop signage; body at width 100, weight 400, 17px, line-height 1.6.
- **IBM Plex Mono** for data only: store names in labels (`au · acme-au.myshopify.com`), commands, numbers in tables.
- Scale: 13 / 15 / 17 / 20 / 24 / 32 / 44 / 60 / 84. Display tracking −0.02em; uppercase labels +0.08em.

## Shape and depth

Radius 14px on panels, 999px on chips, 10px on buttons. One light source from above: `box-shadow: 0 1px 2px rgb(20 33 28 / .06), 0 8px 24px rgb(20 33 28 / .06)`. No coloured glows.

## Signature moves

1. **The store rack.** Store names set large in a stacked list; the store currently answering is in ink, the rest at opacity 0.35 — taken from shipped location sections and reused wherever stores are listed.
2. **The label line.** Every answer starts with a mono label `store: au (acme-au.myshopify.com)` on a mint chip — the product's own output format, shown as is.

## Motion

One authored moment per page at most, always behind `prefers-reduced-motion: no-preference` and switchable off with `?motion=off`. Transitions 200–300ms ease-out. No scroll hijacking.
