# shopify-multistore-mcp — design system

Mined from the tag ring icon (`design/icon/icon.svg`): a porcelain ground carrying one jade family in soft clay, three store tags on one ring. The marketing page (`design/marketing/index.html`) turns that object into its layout: one jade rail runs across the first screen and everything hangs from it. Taken: porcelain, jade, clay tags with cut top corners, label tape for store names. Left: Shopify's bag green (#95BF47) and anything that reads as a Shopify surface.

## Colour

Light only (`color-scheme: light`); the 0.3 page's dark theme was not carried into this redesign.

| Token | Value | Role |
|---|---|---|
| `--porcelain` | `#F6F6F3` | page ground |
| `--surface` | `#FDFDFB` | cards, tables, the question card |
| `--ink` | `#14211C` | headings, body, the terminal panel |
| `--ink-2` | `#4E5A55` | secondary text (5.6:1 on the darkest tag shade) |
| `--ink-3` | `#5F6B66` | the grey half of the hero headline (4.8:1 on the tag) |
| `--line` | `#DFE3DF` | rules and borders |
| `--jade` / `--jade-lit` | `#1CB884` / `#4FDCA5` | the rail, strings and grommets; never text on porcelain |
| `--jade-deep` | `#0A6F5C` | buttons, links, small accent text |
| `--jade-ink` | `#064A3C` | the one drenched band (why choose it) |
| `--mint` → `--mint-shade` | `#DDF3E9` → `#C8EBDA` | clay tag faces; our column in comparison tables |
| `--tape` | `#0B5D4D` | label tape, white embossed capitals (7.7:1) |
| `--amber-ink` on `--amber-wash` | `#6A4A12` on `#F3EBDD` | "Their lead" marker on comparison rows |
| `--veto` | `#A33224` | refusals |

Strategy: committed. Jade carries the rail and tags in the first screen and owns the comparison band outright; everywhere else the page is porcelain and ink.

## Type

- **Gabarito** 700–800 for display: the headline, section heads, big figures and the label tape. Hero headline clamps 34–54px at −0.025em; section heads 32–48px.
- **Atkinson Hyperlegible Next** 400/600 for everything set in sentences: 17px on 1.6, 18–19px for leads. Chosen for a non-technical reader.
- **JetBrains Mono** for data and commands only: store domains, the setup command, captions, eyebrows.

## Shape and depth

Tags: cut top corners (`clip-path`, 34px cut), 22px radius at the bottom, a punched hole with a jade grommet, and a soft two-step drop shadow from one light above. Pills for buttons and chips; 14–20px radius on cards and tables.

## Signature moves

1. **The tag line.** One full-bleed rail under the header. The hero copy hangs on the largest tag; the question card spans the strings so it visibly goes to every store; three store tags hang at different drops. On narrow screens the rail turns vertical and the store tags hang sideways from it.
2. **Label tape.** Every store name, and nothing else, is set as a strip of embossed tape at a slight angle. Never a headline, never a button.

## Motion

One authored moment: the tags swing once on load and again when a question chip changes the answers. Behind `prefers-reduced-motion: no-preference`, switchable off with `?motion=off`. Transitions 200–300ms. No scroll hijacking.
