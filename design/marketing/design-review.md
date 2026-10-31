# Design/UX review — marketing page, tag line redesign

**Verdict:** Solid (2 of 2 surfaces, all stages) — one real defect found and fixed: the setup command's Copy button failed silently; everything else is polish, false positives or questions for the owner.

31 October 2026. Surfaces: `design/marketing/index.html` (Persuade) and its shared header and footer. Copy is by Gemini 4 Argon and was not reviewed for wording.

## Fixed during the review

[High] Setup, step 1, terminal Copy button — clicking it threw `Cannot read properties of null (reading 'cloneNode')` and copied nothing.
→ Should be: the button looks for the command in its terminal panel, not in its direct parent (`b.closest('.term').querySelector('code')`).
→ Why: Copy moved into the terminal's title bar during the build, so its parent no longer held the command; the one action step 1 asks for did nothing, with no message. Re-tested in Chromium: all three Copy buttons put the exact command on the clipboard, without the `$` prompt, and show "Copied".
   (Tier: 1) (Lenses: interaction, flow) (Evidence: crops/copy-done.png @2x, 1280px)

[Low] "How it works" section — the four outcome headings sat under the problem heading in the outline.
→ Should be: a visually hidden `<h2>How it works</h2>` before the list, which also names the list. Done; the outline now reads h1, h2, h2, h3 × 4.
→ Why: a screen-reader user jumping by heading heard "Nine reports across every store" filed under "Shopify's AI connector holds one store at a time".
   (Tier: 2) (Lenses: semantics)

[Low] Stylesheet — 10 distinct declared corner radii.
→ Should be: a three-step scale (`--r-sm` 8, `--r-md` 14, `--radius` 22) plus pills; the only other radii left are the rail, strings and grommet geometry.
→ Why: near-miss radii (10/12/14/16/20) read as drift, not as a system.
   (Tier: 2) (Lenses: systematisation)

[Low] Store tag figures — no tabular numerals, so digits shifted width as the demo questions changed.
→ Should be: `font-variant-numeric: tabular-nums` after the `font` shorthand (the shorthand resets it if it comes first). Done and read back as `tabular-nums`.
   (Tier: 2) (Lenses: craft)

[Low] 11px labels ("Their lead" marker, phone table cell labels) lifted to 12px; the competitor's name may now wrap below 360px instead of being held on one line.

## Not defects

- **Two text overlaps** (1280 and 375): the "nodejs.org" link inside a wrapped recovery line (its box overlaps the bold lead's multi-line box, not its glyphs), and the comparison table's visually hidden column header on phones. Both opened as crops; neither shows.
- **Left-edge disagreement** across headings: hero copy sits inside its tag and outcome titles sit after their number tags, by design.
- **A 17px-tall target**: the "Shopify Developer Community" link inside the quote's citation, covered by WCAG 2.5.8's inline exception.
- **Hard text-shadow on the label tape**: deliberate; the referent is embossed tape.

## Coverage

- **Surfaces:** 2 of 2 (marketing page, shared chrome).
- **Screens:** one page at 375, 600, 768, 1024, 1280 and 1920 in Obscura; 320, 375, 768, 1280, 1440 and 1920 in Chromium.
- **Component types:** 84 inventoried at 1280; 16 opened as their own crops at DPR 2 (every interactive type, both overlap suspects, the comparison row, recovery list, status, header scrolled), the rest judged inside full-page tiles.
- **States driven:** chips (rest, hover, focus, pressed), primary button (rest, hover, focus), Copy (rest, hover, done), manual configs (open, tab focus), FAQ (hover, open), header (scrolled), reduced motion (Chromium emulation: no swing, no smooth scroll). Not driven: Copy's error state, which needs a browser that refuses clipboard access.
- **Contrast:** 0 failed of 204 examined at 375, 205 at 600 and 768, 210 at 1024, 1280 and 1920 (32 judged against gradient stops).
- **Tokens:** matched against `docs/positioning/DESIGN.md`; colours, type and radii come from its tokens.
- **Not measurable on this engine:** Obscura would not answer 20 channels, including padding, margin, gap, box-shadow, border radius, animation, transitions, print and reduced-motion emulation, and web fonts. Radii, shadows and durations were counted from the stylesheet, and fonts, motion and pixels were checked in Chromium instead.
- **Ledger:** 16 cells, 0 open.
- **Lookalike:** 3 of 4 met against the 0.3 page this replaces, the category's split-hero-plus-chat-card page and Retool's hero. Type, signature and swap test met. Topology is a documented deviation: the copy still sits left of the demo, because the blind check during ideation found a conventional reading order beat both bolder worlds. Ten layout families across eight sections, 20+ first-viewport elements, and display face Gabarito against the old Archivo.

Gates clean: no failures among the checks that ran. Design sound: yes, within the questions below.

## Open questions

- The 0.3 page had a dark theme; this one is light only (`color-scheme: light`). Worth adding back?
- "Connect your stores" lands on "Set it up with one command", whose first step is a terminal command. The label was kept from 0.3; "Set it up" matches the destination more literally.

## Needs verification

- What a screen reader announces when a question chip changes the three answers (the list is a polite live region).
- Clipboard behaviour in Safari and Firefox, including the "Select and copy" fallback.
- Whether a non-technical reader can follow step 1 without help; only a person trying it can answer that.
