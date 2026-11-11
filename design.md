# design.md — Project 7: Movie Statistics

How to style the final site. This file covers look and motion only. What the
site does is in the spec.

## Inspo

- https://ascii.rest/ — animated ascii art for web pages. Dark page, one
  monospace typeface, links written as `[docs]`, pieces drawn from characters.
- https://ascii.rest/icosahedron/ — the wireframe icosahedron for the enter
  screen. Near edges are solid lines, hidden edges are dotted.
- https://github.com/stackedlol/ascii-sharks — fish and sharks drawn as ASCII
  on a canvas, zero dependencies.

## Style in one line

Ascii, Halftone, Dither. Easy Colors to be able to present. Smooth 60 fps
animations.

## Rules

1. Everything on screen is made of characters. No images, no icons, no
   rounded cards, no drop shadows, no gradients.
2. One monospace typeface for the whole site.
3. Shading is done with Halftone and Dither (dots of different weight), never
   with opacity fades or blur.
4. Color is for meaning. Most of the screen is cream ink on a navy background.
5. It has to read from the back of a classroom on a projector.

## Colors

Easy Colors, cinema at night: a midnight navy background, warm cream ink, and
marquee gold sparkles. Seven colors. Nothing else.

| Token | Color | Hex | Used for |
| --- | --- | --- | --- |
| `--bg` | Midnight navy | `#0E1220` | Page background |
| `--ink` | Warm cream | `#F2E9D8` | Main text, actors, lines not yet explored |
| `--ink-dim` | Slate blue | `#5C6788` | Halftone dots, borders, labels, inactive tabs |
| `--accent` | Soft blue | `#7AA2F7` | Active tab, hover, the actor the user picked |
| `--green` | Mint green | `#5EE6A0` | Green path: part of the answer |
| `--red` | Coral red | `#FF6B6B` | Red path: explored and rejected. Fully red: not possible |
| `--spark` | Marquee gold | `#FFC857` | Sparkles out |

- Green and red never mean anything else. No green buttons, no red warnings.
- Gold is only for sparkles, so the finish of an animation stands out.
- Projectors wash out dim blues. Check `--ink-dim` on the classroom projector
  and lighten it if the Halftone dots disappear.
- Do not rely on color alone, since some viewers cannot tell green from red.
  A green path is drawn with solid glyphs. A red path is drawn dotted, the
  same way the icosahedron dots its hidden edges.
- Dark theme only.

## Type

- Typeface: a monospace such as JetBrains Mono or IBM Plex Mono, falling back
  to `ui-monospace, Menlo, Consolas, monospace`. Load one weight (400) and
  one bold (700).
- Sizes: body 16px, labels 14px, tab names 18px, results 24px. Nothing under
  14px.
- Lowercase for labels and tabs. MOVIE STATISTICS is the only all-caps text.
- Links and buttons are written in square brackets: `[enter]`, `[add actor]`,
  `[replay]`. Hover turns the text `--accent`.

## Glyphs

| Purpose | Glyphs |
| --- | --- |
| Halftone and Dither ramp, light to dark | `·` `•` `●` |
| Lines | `-` `_` `|` `/` `\` |
| Dotted lines (rejected, hidden) | `.` `:` `'` |
| Actors | `o` normal, `@` picked or on the answer, `+` rejected |
| Box frames | `+` `-` `|` |
| Sparkles | `*` `+` `.` `'` |

## Layout

- One screen, no page scroll while an animation is playing.
- Top bar: MOVIE STATISTICS on the left in small text, the 3 tabs in the
  middle as `[ largest path ] [ shortest cycle ] [ six degrees of bacon ]`,
  and `[algorithms explained by Claude]` on the top right, the link to the
  page which explains the algorithms.
- Under the top bar: the tab's title in 24px (it also names the browser tab,
  for example "six degrees of Kevin Bacon"), one line on what it shows, then
  the actor fields for that tab with `[random]` buttons.
- The rest of the screen is the workspace: the stage on the left, framed,
  with a caption bar on top telling what the algorithm is doing and the
  `[< step]` `[pause]` `[step >]` `[skip]` `[replay]` controls; the report on
  the right.
- The report: the answer in 24px (for example "distance 12"), then the chain
  drawn as a graph, top to bottom: each actor a green `@` node, each movie a
  green `|` edge to the next. A cycle ends back on its first actor.
- Active tab is `--accent`. Inactive tabs are `--ink-dim`.
- Inputs are a label, then an underline of `_` characters. Autocomplete is a
  box frame under the field, with the highlighted row in `--accent`.

## Enter screen

- Center of the screen: the icosahedron from ascii.rest, turning.
- Inside it: the big text in ASCII saying MOVIE STATISTICS. This is the enter
  button. The whole icosahedron is clickable, and Enter on the keyboard works.
  The text grows and shrinks with the icosahedron: marquee dots (`●`) on big
  screens, FIGlet letters on a laptop, plain text when small. The wireframe
  stops one cell short of the letters.
- Behind it: a slow Halftone dot field in `--ink-dim`. This is the only
  Halftone background on the site; the tabs' stages have none.
- On enter, the icosahedron dissolves into dots and the tabs appear.

## Algorithms Explained By Claude

- A second page, linked from the top bar, with `[back to movie statistics]`
  on its top right. It scrolls: it is long text, not an animation.
- One section per algorithm: the explanation in plain words (75 characters a
  line at most), its running time in `--ink-dim`, then buttons for friendly
  cases on the tiny dataset (whose picture heads the page).
- Each section has its own stage and report. A case starts paused on its
  first step; every step is listed under the canvas, the current one in
  `--accent`, and clicking one jumps to it.

## Animations

Smooth 60 fps animations. Movement (positions, paths growing, sparkles) is
drawn at 60 fps. The icosahedron piece itself is built for 30 fps, which is
fine as long as everything around it stays at 60.

- **Live linking (tab 1 and tab 2):** actors appear as `o`. Links are tried
  one after another in `--ink`. A link that leads nowhere turns red and
  dotted, then dissolves into dots and is gone. A link that is part of the
  answer turns green and solid. Actors are named on the stage while they are
  being looked at: the two ends from the start, a round's actors while that
  round is told, the answer's actors once it is found.
- **Sparkles out:** when the answer is reached, the green path flashes
  `--spark`, sparkle glyphs fly off the two end actors for about one second,
  then the result line appears.
- **Cycle (tab 2):** the picked actors sit on a ring as `@` in `--accent`. The cycle is
  drawn link by link in green until it closes on the first actor.
- **Not possible:** every link tried ends up red and dotted, and the result
  line says why, in `--red`.
- **Circles inside circles (tab 3):** the chosen actor is `@` in `--accent` in
  the center.
  Every step another layer gets added as a ring of dots, one dot per actor,
  with the number of actors in that layer next to it. Outer layers use
  lighter Halftone dots. Picking a dot draws its link back to the center in
  green.
- Timing: a full animation runs 5 to 15 seconds, so it fits a presentation.
  `[replay]` runs it again. `[skip]` jumps to the result. `[< step]` and
  `[step >]` pause and move one step of the algorithm at a time.
- After the end the stage keeps moving: a spark (`*` `+` `.` in `--spark`)
  runs along the answer, or, on the rings with no chain, a dotted sweep turns.

## Rendering

- Draw the stage on a canvas as a grid of character cells, the way
  ascii-sharks does. Plain text (top bar, fields, result line) stays as
  normal page text so it can be selected and read by screen readers.
- One animation loop for the whole stage. Only redraw cells that changed.
- Tab 3 can have thousands of actors in a layer. When a ring has more actors
  than cells, one dot stands for several actors and its weight (`·` `•` `●`)
  shows how many.
- If the user prefers reduced motion, skip straight to the finished result.

## Do not

- No images, emoji, or icon fonts.
- No colors outside the table above.
- No second typeface.
- No opacity fades, blur, or glow.
- No text smaller than 14px.