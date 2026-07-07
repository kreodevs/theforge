---
source: https://x.ai/
brand: xAI
style: xAI Light
themes: [light]
default_theme: light
extracted: 2026-06-10T13:17:02.401Z
generator: design-extractor
---

# DESIGN.md

## Design Summary

xAI's design system is a high-contrast, developer-forward light theme built on a near-black (#0a0a0a) and white (#ffffff) core. The layout uses generous whitespace with a centered hero and pill-shaped CTAs. Two custom typefaces — universalSansDisplay for large headings and universalSans for body/UI — are paired with GeistMono for code and terminal content. The dark terminal panel (code editor mockup) creates a dramatic visual contrast against the white page. CSS custom properties follow a semantic naming system (--primary, --accent, --background, --card) mapped to a named color scale (jet, charcoal, umbra, fog, dove, ivory, etc.).

## Style Tags

`pill-radius-dominant`, `dual-typeface-hierarchy`, `monospace-code-accented`, `high-contrast-near-black-on-white`, `terminal-dark-panel-contrast`

## Colors

| Token | Hex | Role | Context |
|-------|-----|------|---------|
| jet-black | #0a0a0a | text | Primary button fill, heading text, nav text, body foreground |
| white | #ffffff | primary | Page background, input background, ring offset |
| ivory | #f9f8f6 | background | Card surface background |
| dove | #d5d9e2 | border | Borders, dividers, button outlines, input borders |
| umbra | #1f2228 | background | Dark terminal/code panel background, hero dark section |
| fog | #7d8187 | text | Secondary text, muted nav labels, subheadings |
| warm-sand | #d7d1c9 | text | Muted body text in dark sections, secondary text on dark backgrounds |
| sunset-orange | #ff6308 | background | Accent highlights, 'New' badge border, CTA accent |
| ink-dark | #24292e | text | Code block text, syntax highlighting base |
| terminal-red | #ff5f57 | background | Terminal traffic light — close button |

## Typography

| Token | Font | Size | Weight | Line Height | Letter Spacing | Role |
|-------|------|------|--------|-------------|----------------|------|
| display-hero | universalSansDisplay | 60px | 500 | 60px | -1.5px | Hero headline — primary page title |
| display-large | universalSansDisplay | 72px | 400 | 72px | -1.8px | Extra-large display headings |
| body-default | universalSans | 16px | 400 | 24px | normal | Body copy, nav items, general UI text |
| ui-medium | universalSans | 14px | 500 | 20px | normal | Button labels, tags, UI controls |
| ui-small | universalSans | 13px | 400 | 21.125px | normal | Small labels, captions, secondary UI |
| code-default | GeistMono | 13px | 400 | 24px | normal | Code blocks, terminal output, inline code |
| code-small | GeistMono | 12px | 400 | 19.5px | normal | Small code annotations, line numbers |
| code-micro | GeistMono | 11px | 400 | 17.875px | -0.11px | Micro code labels, terminal status text |

## Spacing
- space-1: 2px (2px)
- space-2: 4px (4px)
- space-3: 6px (6px)
- space-4: 8px (8px)
- space-5: 12px (12px)
- space-6: 14px (14px)
- space-7: 16px (16px)
- space-8: 18px (18px)
- space-9: 20px (20px)
- space-10: 24px (24px)
- space-11: 32px (32px)
- space-12: 40px (40px)
- space-13: 48px (48px)
- space-14: 96px (96px)

## Border Radius
- pill: 9999px (9999px)
- card: 12px (12px)
- medium: 16px (16px)
- small: 8px (8px)
- base: 6px (6px)
- micro: 3px (3px)

## Fonts

(none)