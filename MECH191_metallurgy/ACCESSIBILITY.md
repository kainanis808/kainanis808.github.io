# Accessibility notes — MECH 191 site

Goal: every page can be used with a screen reader (VoiceOver, NVDA, JAWS) and a keyboard alone,
following WCAG 2.1 AA, which is the standard used for ADA Title II compliance.

## What is in place

**Shared files (site root):**

- `a11y.css`: visually hidden text (`.sr-only`), the skip link, a visible focus outline, and reduced motion support.
- `a11y.js`: things that have to run in the browser. It makes clickable cards, rows, legend items and step dots work with the keyboard (Tab, then Enter or Space). It keeps `aria-pressed` in sync on tab and toggle buttons. It reads out info panels and readouts that change after a control is used, gives sliders their visible value through `aria-valuetext`, moves focus to detail panels when they open, and removes symbols such as ▶ and ↺ from button names. It also adds "(PDF)" and "(opens in new tab)" hints to links.

**Changes made in each HTML page:**

- `lang="en"`, a `<main>` landmark, and the two lines that load `a11y.css` and `a11y.js`.
- Every `<canvas>` and diagram `<svg>` has `role="img"` and an `aria-label` that describes what the figure shows. The interactive HAZ cross-section is the exception. It is a `role="group"` whose zones are keyboard buttons.
- Every `<table>` has a visually hidden `<caption>`, and every `<th>` has `scope="col"` or `scope="row"`.
- Every slider, select box, and number input has an `aria-label`.

## Adding a new page

1. In `<head>`, add the following, using `../` for pages that are one folder down:

   ```html
   <link rel="stylesheet" href="../a11y.css">
   <script src="../a11y.js"></script>
   ```

   Do not mark the script `defer` or `async`. It has to load before the page's own scripts.
2. Wrap the page content in `<main>`.
3. Give each diagram a text alternative that explains what a student should take from it, not only what it looks like:

   ```html
   <canvas id="x" role="img" aria-label="Chart of hardness versus tempering temperature: hardness drops steadily from 60 HRC at 200 °C to 30 HRC at 650 °C."></canvas>
   ```

4. For tables, add `<caption>` (it can use `class="sr-only"`) and put `scope` on each `<th>`.
5. Use `<button>` for anything clickable. If you have to use a `<div>`, `a11y.js` adds keyboard support for it, but a real button is better.
6. Every input needs a `<label for>` or an `aria-label`.

## Colour contrast (WCAG 1.4.3)

All text now meets 4.5:1 (3:1 for large text). This was checked in every tab and toggle state of every page, on canvas diagram labels, and on SVG labels.

- **Page text:** low-contrast greys and accent colours were shifted lighter (dark pages) or darker (light pages) by the smallest amount that passes. The hue stays the same, so each page keeps its look.
  - Example on dark pages: #475569 becomes #8192aa.
  - Example on light pages: #94a3b8 becomes #627793.
  - Graphics drawn on `<canvas>` were not recoloured.
- **Canvas diagram labels:** `a11y.js` section 8 checks the pixels behind each label as it is drawn. If a label would fail, it nudges the label's colour lighter or darker, keeping the hue. Labels that already pass are drawn exactly as written, and new diagrams get this automatically.
- **SVG labels:** fixed individually in the markup.
- **Small CSS overrides:**
  - Bar-chart percentages on die, investment and sand casting use dark text.
  - Dimmed periodic-table cells use a grey filter instead of 20% opacity.
  - NDT case-study labels use a darker grey.

## Diagram labelling fixes

Labels that overlapped, were cut off at the canvas edge, or were drawn off-screen were repositioned. In most charts the inline labels were replaced with a legend. Pages changed:

- **Atomization:** legends, H/D labels.
- **Corrosion:** 0 V marker, Cl⁻, SCC.
- **Cutting & chip formation:** tool wear, tool geometry, deformation zones, ISO grades.
- **Die / investment / sand casting:** tolerance charts and design cards.
- **Forging:** grain-flow captions, radar legend, rib chart, ram label.
- **Forming defects:** NDT captions, utilisation axis now 50–100 %.
- **Forming limit diagrams:** legends and strain-path labels.
- **GMAW:** current axis, gas-blend markers.
- **Hot/cold working:** curve labels, critical-CW annotation, annealing footnote.
- **Powder metallurgy and sintering:** curve legends.
- **Process selection:** band labels now avoid each other.
- **SEM fractography:** labels.
- **SMAW:** electrode-angle panels have room for their notes.
- **Stress–strain curve:** annotations.
- **Tube drawing:** OD/ID labels.
- **Turning & milling:** Ra labels, engagement labels.
- **Weld cracking:** H symbols placed on a fixed pattern.
- **HAZ chart:** scale text.
- **Casting / PM defect card thumbnails:** drawn at 2× resolution.

Content corrections made along the way:

- **FLC₀ (Forming limit diagrams):** the Keeler–Brazier formula used 360·t, which is the coefficient for t in inches. With t in mm the curves went off the chart, so it is now 14.13·t, with a matching note on the page.
- **Taylor tool-life inset (Cutting & chip formation):** now plots T = (C/Vc)^(1/n) on a log scale, so all three tool materials show.

## Lines, shapes and form controls (WCAG 1.4.11)

Lines (1.5 px and wider), solid shapes and form-control borders need 3:1 contrast against what is next to them.

- **Canvas diagrams:** `a11y.js` section 9 handles these as they are drawn.
  - Before a line is drawn, both sides of it are sampled. If neither side reaches 3:1, the line colour is shifted lighter or darker, keeping the hue.
  - When a solid shape's fill doesn't stand out from its surroundings, a 1 px outline in a contrasting shade of the same hue is drawn around it.
  - Thin grid lines, see-through overlays and tiny texture specks are left alone.
- **Canvases marked `data-a11y-essential`** are not adjusted, because their realistic look is the content. These are the simulated SEM and fracture-surface images, the solidification and dendrite simulations, the atomized-powder SEM views, and the 3D screw-dislocation animation. Use the same attribute on any future canvas that should keep its exact colours.
- **SVG diagrams:** about 300 shapes got a contrasting outline (`stroke` plus `vector-effect="non-scaling-stroke"`) or a stronger stroke colour in the page markup. Examples are steel plates, weld pools, droplets, HAZ zones and lattice atoms. Pale tinted background bands that only sit behind text labels were left as they were.
- **Form controls:** `a11y.js` darkens or lightens any author-styled input, select or slider border that falls below 3:1 against the page.
- **Known remainders:** about 50 small SVG shapes that sit on top of a similar colour (droplets over the weld pool) or are slightly see-through are still between 2.5:1 and 3:1. Four canvas outlines in the investment casting, tube drawing and turning/milling diagrams also measure under 3:1, but looked clearly visible when checked by eye.

## Documents updated

- `referencePages/MECH191_Key_Terms_Glossary.docx` and `.pdf`: the FLC₀ formula is corrected from 360·t to 14.13·t, with t in mm, and a note on units was added. The PDF was re-exported with LibreOffice and is still 54 pages.
- No other PDF, slide deck, handout or quiz contained the corrected formula or any of the other changed material.

## Known gaps / to do

- **Canvas mouse-only extras:** some charts can be read by hovering or clicking (forming limit diagram strain readout, process selection chart hover, rotating the 3D crystal model). The same information is in the nearby text, tables, or legend buttons.
- **Documents:** the PDFs, DOCX, and PPTX files are not covered here and need their own accessibility pass.

## Testing

- Run the axe DevTools browser extension or Lighthouse → Accessibility on a page.
- On Mac: VoiceOver (Cmd+F5), then Tab through the page and use VO+U to open the rotor of headings, tables, and landmarks.
