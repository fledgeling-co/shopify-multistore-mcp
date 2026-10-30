# Design review: marketing site and positioning report

31 October 2026. Surfaces: `design/marketing/index.html` (Persuade) and `docs/positioning/positioning-report.html` (Read), plus the marketing page's header and footer. 3 of 3 surfaces reviewed, every stage done or marked n/a.

**Verdict: ship.** The review found 13 defects, and all 13 are fixed and re-measured in Chromium. No Blocker was found. The two worst problems were on phones: the Copy button covered the set-up instructions, and the set-up tabs wrapped onto three rows.

## Fixed

| # | Severity | Surface | What was wrong | Fix |
|---|---|---|---|---|
| 1 | High | marketing | At 320 and 390px the Copy button sat on top of the "where to paste" instruction text in the set-up panels. A glyph-level overlap was measured on 4 of 4 panels at 320px and 3 of 4 at 390px | Instruction text reserves 96px on the right. Below 420px the button sits under the code instead of floating over it |
| 2 | Medium | marketing | The four set-up tabs wrapped onto three uneven rows on phones | Below 560px they form a 2×2 grid |
| 3 | Medium | marketing | The set-up commands were cut off at the panel edge on phones, and the panels scrolled sideways with no cue | The code wraps (`pre-wrap`). Copy still copies the original text |
| 4 | Medium | marketing | The Questions section was centred while every other section sits on the left rail (heading at 254px against 64px at 1280) | The FAQ rows are capped at 820px and the wrapper stays on the rail |
| 5 | Medium | report | The claims table listed 7 claims while the page says 9, and the prose cites C-009, which had no row | Added C-007 and C-009 from `work/ledger.json` |
| 6 | Medium | report | The six scrolling tables could not be reached by keyboard, had no name, and gave no cue that they scroll at phone widths | Each is now `tabindex="0"`, has `role="region"` and is labelled after its heading. Each also has a visible focus ring and an edge shadow while there is more to scroll |
| 7 | Low | marketing | The sales table in "Ask every client store at once" scrolled sideways by 12–82px between 390 and 320px | Below 520px the padding is smaller and the table has no minimum width |
| 8 | Low | marketing | The demo's store labels broke inside the hostname (`harbour-` / `coffee.myshopify.com`) | The hostname stays whole and moves to the label's second line |
| 9 | Low | marketing | The three example-output panels carried `aria-label` on plain divs, which is not announced, and `role="img"` hid the sample table from screen readers | All three are now `role="figure"` |
| 10 | Low | marketing | Footer links were 22px tall | They are now at least 24px tall (measured). The inline links inside sentences fall under the WCAG 2.5.8 inline exception |
| 11 | Low | report | Paragraphs after a table sat almost on the table's last rule | They now have a 1.25rem gap |
| 12 | Low | report | "J · eliminated" wrapped and left the dot dangling. Numeric headers were set in mono while the other headers were sans, and the Sample column right-aligned words like "weekly" | The cell no longer wraps. Headers use one face, and the Sample column is plain text |
| 13 | Low | report | The "Feel the copy" cards show buttons that do nothing | A line under the heading says they are part of the preview |

The decision doc named "Set it up" as the one action, but the copy pass shipped "Connect your stores". `00-decision.md` now records the label that shipped.

## Coverage

- Probe sweep: Obscura 0.2.0 at 375, 768, 1280 and 1920 on both surfaces, with 0 contrast failures. Obscura could not read 20 measurement channels, including padding, margin, gap, box-shadow, animation and web fonts, so those zeros are not results.
- Pixels: Playwright Chromium. Full pages at 320, 375, 390, 768, 1280 and 1440, dark mode at 390 and 1280, and element crops at DPR 2 of the tabs, the demo, the output fragments, the FAQ, the footer and five report tables. Copy-button overlap was measured with text ranges rather than boxes.
- Component inventory: the marketing page has 50 component types. Crops were opened for 6 (tabs, set-up panel with its Copy button, demo, output fragment, FAQ, footer). The rest were judged only inside full-page tiles.
- Keyboard: the marketing page's first 14 tab stops and the report's first scroll region. Every stop showed a 2px jade focus ring.
- Token source: matched against `docs/positioning/DESIGN.md`. Both pages use its palette and type pair.

## Advisory, not fixed

- On the marketing page, the stylesheet declares 11 font sizes, 6 weights and 5 border radii. The type spread comes from the display scale, while 5 radii is drift. The report has 14 sizes, with near-misses at 13px against 13.6px.
- In markup, the marketing page's states cover 2 of 6. JavaScript adds `loading` (demo), `done` and `error` (Copy). Empty and offline states do not apply, because nothing loads data.

## Needs verification

- Screen-reader reading order of the demo's live region when a question chip is pressed.
- Clipboard behaviour in Safari and Firefox, including the "Select and copy" fallback.
- Whether non-technical readers can follow step 1 without help. Only a person trying it can answer that.
