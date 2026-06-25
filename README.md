# SlideDown — Standalone Slide Deck

A zero-dependency, single-file HTML presentation app. Works offline.
Just open `slideshow.html` in any modern browser.

## Quick Start

1. Open `slideshow.html` in Chrome, Firefox, Safari, or Edge
2. Press **F** for fullscreen
3. Use **→** / **←** to navigate

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| → ↓ Space PgDn | Next slide / fragment |
| ← ↑ PgUp | Previous slide / fragment |
| Home | First slide |
| End | Last slide |
| 1–9 + Enter | Jump to slide number |
| F | Toggle fullscreen |
| S | Open presenter view (new window) |
| O or G | Toggle slide overview grid |
| ? or H | Show keyboard shortcut help |
| Ctrl+P | Print / Export to PDF |

## Touch / Mobile

- **Swipe left** → next slide
- **Swipe right** → previous slide
- **Tap right third** → next slide
- **Tap left third** → previous slide

## Presenter View

Press **S** to open a presenter window showing:
- Current slide
- Next slide preview
- Speaker notes
- Elapsed time clock (with reset button)

Navigation in either window stays synchronized.

## Export to PDF

1. Press **Ctrl+P** (or Cmd+P on Mac)
2. Set orientation to **Landscape**
3. Enable **Background graphics** in print settings
4. Choose **Save as PDF**

All fragments are fully revealed in the PDF. Speaker notes are excluded.

## Advanced Templating

For managing larger decks, use the built-in templating system:

1. Configure your deck in `deck.json`.
2. Add slides as Markdown or HTML files in the `slides/` directory.
3. Build the deck:
   ```bash
   ./deck_tool.py build --config deck.json
   ```
This approach allows separating slide content, using Markdown, and managing complex layouts and themes more effectively than editing HTML directly.

## Editing Slides (Manual)

Slides are `<section>` elements inside `<div class="sd-deck">`. To add a slide:

```html
<section data-transition="fade">
  <h2>Your Title</h2>
  <ul>
    <li class="fragment">Revealed one at a time</li>
    <li class="fragment">On each key press</li>
  </ul>
  <aside class="notes">Speaker notes go here.</aside>
</section>
```

### Transition Types

Set `data-transition` on any `<section>`:
- `fade` (default) — crossfade
- `slide` — horizontal push
- `none` — instant

### Fragments

Add `class="fragment"` to any element to reveal it incrementally.
Optionally set `data-index="N"` to control reveal order.

### Special Slide Layouts

- `class="title-slide"` — centered, larger text (for title/cover slides)
- `class="impact-slide"` — centered, large heading (for key statements)

### Theming

All colors are CSS custom properties in `:root`. Change the theme by
editing the variables at the top of the `<style>` block:

```css
:root {
  --bg: #0f111a;
  --bg-slide: #1a1d2e;
  --text: #cdd6f4;
  --heading: #ffffff;
  --accent: #89b4fa;
  --accent-alt: #f38ba8;
  /* ... */
}
```

## Media Demo Deck

`media-demo.html` is a second presentation demonstrating embedded rich
media — AI-generated images (Imagen 3) and video (Veo 3.1) encoded as
base64 data URIs. Everything is self-contained in one 15 MB HTML file.

Open it the same way: `media-demo.html` in any browser. Same keyboard
shortcuts apply (no presenter view or overview mode in this deck).

## Live Demo (GitHub Pages)

- Main deck: https://hexadecimoose.github.io/slidedown/slideshow.html
- Media deck: https://hexadecimoose.github.io/slidedown/media-demo.html

## File Sizes

| File | Size | Contents |
|------|------|----------|
| `slideshow.html` | ~50 KB | Presentation engine + 10 POC slides |
| `media-demo.html` | ~15 MB | Media deck with 4 embedded images + 1 video |

No external dependencies of any kind.
