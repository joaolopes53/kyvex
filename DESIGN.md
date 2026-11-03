---
framework: Astro 7.4 (static output)
typeface: Plus Jakarta Sans (SIL Open Font License), JetBrains Mono for labels
motion: GSAP 3.15 (ScrollTrigger, SplitText), Lenis 1.3
webgl: three r187
tokens:
  color:
    bg: "#030304"
    surface: "#11141d"
    line: "#232839"
    text: "#e8ecf6"
    muted: "#8b92a6"
    accent: "#8db8ff"
    on-accent: "#030304"
  font:
    display: "'Plus Jakarta Sans', system-ui, sans-serif"
    body: "'Plus Jakarta Sans', system-ui, sans-serif"
    mono: "'JetBrains Mono', ui-monospace, monospace"
  text:
    label: 0.75rem
    body: clamp(1rem, 0.95rem + 0.25vw, 1.125rem)
    lead: clamp(1.5rem, 1.1rem + 1.6vw, 2.5rem)
    heading: clamp(2rem, 1.5rem + 2vw, 3.25rem)
    title: clamp(2.5rem, 1.5rem + 4vw, 5rem)
    display: clamp(3rem, 1rem + 7vw, 8.5rem)
  space:
    gutter: clamp(1rem, 0.5rem + 2vw, 2.5rem)
    section: clamp(6rem, 4rem + 10vw, 14rem)
  radius: 1rem
  ease-out: cubic-bezier(0.22, 1, 0.36, 1)
---

# Kyvex design contract

Tokens live in `src/styles/global.css` as CSS custom properties. Components reference them and do not define colours or type sizes of their own. Two decorative exceptions: the violet companion star in Team (`#b59cff`) and the per-project planet hues in Work.

## North star

A customer-facing studio portfolio. One scroll-driven flight through a realistic black night sky: content floats over a fixed WebGL starfield, and the page ends with the stars forming the KYVEX wordmark above the contact block.

## Background scene

- Pure black sky, a denser band of distant stars, and stars with real stellar colours (blue-white to orange). No nebulae.
- Scrolling moves the camera forward through the star field. Behind page copy the scene dims to 55 % brightness.
- The mouse tilts the view slightly and lights constellation stars it passes over; lit stars are joined by lines. Twelve real constellations sit along the flight, unlabelled, their edges always faintly visible and brighter as the pointer nears.
- The whole scene renders in a single pass; easing is scaled by frame time.
- Meteors cross the sky one at a time, with a 3 to 8 second pause between them.
- Touch input has no pointer effects; the scene still animates with scrolling.
- `prefers-reduced-motion: reduce` renders a static scene.
- Without WebGL, `.no-webgl` shows a plain background.

## Components

| Component | Pattern |
|---|---|
| Header | Fixed, mono uppercase labels, underline grows on hover |
| Hero | Sticky block, display headline with an italic accent word |
| Work | Pinned horizontal strip at 900 x 600 px and above with normal motion preferences, stacked grid otherwise; CSS planet visual per project |
| Team | Binary-star orbit between two member columns |
| Experience | Rows that fill with the accent on hover |
| Testimonials | Alternating left and right quotes |
| Contact | Footer leaving the upper half of the viewport to the wordmark |
| Cursor | Dot that follows the mouse; a ring replaces it over links |

## Do

- Use the shared type classes in `global.css`: `.label` (mono captions), `.section-title` (section headings), `.item-title` (project and member names), `.display-lead` (large lead copy). Component styles add spacing only.
- Share media queries through `src/motion/media.ts` and additive WebGL materials through `src/three/materials.ts`.
- Keep decorative layers `aria-hidden` and `pointer-events: none`.
- Give every motion effect a reduced-motion fallback.

## Don't

- No em-dashes, en-dashes or interpuncts in copy.
- No decorative line bars before labels.
- No one-off colours or font sizes in components.
