# shopify-multistore-mcp — design system

Mined from the tag ring icon (`design/icon/icon.svg`): a porcelain ground carrying one jade family in soft clay, three store tags on one ring. The marketing page (`design/marketing/index.html`) turns that object into its layout: one jade wire runs across the first screen and everything hangs from it, drawn flat. Taken: porcelain, jade, tags with cut top corners, label tape for store names. Left: the icon's clay gloss, which looked dated at page scale. Also left: Shopify's bag green (#95BF47) and anything that reads as a Shopify surface.

## Colour

Light and dark (`color-scheme: light dark`). In dark mode the page goes to `#0E1412` with light text, while tags, screens and tables keep their light tokens, so they read as white objects on a dark ground. Flat throughout: no gradients, gloss or embossing; depth is one hairline edge and one soft shadow.

| Token | Value | Role |
|---|---|---|
| `--porcelain` | `#F6F6F3` | page ground |
| `--surface` | `#FDFDFB` | cards, tables, the question card |
| `--ink` | `#14211C` | headings, body, the terminal panel |
| `--ink-2` | `#4E5A55` | secondary text (about 7:1 on a white tag) |
| `--ink-3` | `#5F6B66` | the grey half of the hero headline |
| `--line` | `#DFE3DF` | rules and borders |
| `--rail` | `#0A6F5C` (dark `#2FD39A`) | the 4px rail, 2px strings and hole rings |
| `--jade` | `#1CB884` | coloured rules in the comparison band; never text on porcelain |
| `--jade-deep` | `#0A6F5C` | buttons, links, small accent text |
| `--jade-ink` | `#064A3C` | the one drenched band (why choose it) |
| `--mint` / `--mint-shade` | `#DDF3E9` / `#C8EBDA` | our column in comparison tables, the version chip, text selection |
| `--tape` | `#0B5D4D` | label tape, flat, white capitals |
| `--amber-ink` on `--amber-wash` | `#6A4A12` on `#F3EBDD` | "Their lead" marker on comparison rows |
| `--veto` | `#A33224` | refusals |

Strategy: committed. Jade carries the wire, the store labels and the buttons in the first screen and owns the comparison band outright; everywhere else the page is porcelain, white and ink.

## Type

- **Gabarito** 700–800 for display: the headline, section heads, big figures and the label tape. Hero headline clamps 34–54px at −0.025em; section heads 32–48px.
- **Atkinson Hyperlegible Next** 400/600 for everything set in sentences: 17px on 1.6, 18–19px for leads. Chosen for a non-technical reader.
- **JetBrains Mono** for data and commands only: store domains, the setup command, captions, eyebrows.

## Shape and depth

Tags: white (`--surface`), cut top corners (`clip-path`, 34px cut), 22px radius at the bottom, a 14px punched hole ringed in `--rail`, and `--lift`: a 1px hairline plus one soft shadow, both as `drop-shadow` so they follow the cut shape. Radii: 8 / 14 / 22 and pills. Buttons are flat fills.

## Signature moves

1. **The tag line.** One full-bleed 4px wire under the header. The hero copy hangs on the largest tag; the question card spans the strings so it visibly goes to every store; three store tags hang at different drops. On tablets (640–1099px) the hero tag spans the width and the store tags hang in a row from a second rail; on phones the rail turns vertical and the tags hang sideways.
2. **Label tape.** Every store name, and nothing else, is set as a flat strip of tape with notched ends. Never a headline, never a button.

## Motion

One authored moment: the tags swing once on load and again when a question chip changes the answers. Behind `prefers-reduced-motion: no-preference`, switchable off with `?motion=off`. Transitions 200–300ms. No scroll hijacking.
