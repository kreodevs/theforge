---
source: https://paperclip.ing/
brand: Paperclip
style: Paperclip Dark Warm
themes: [dark, light]
default_theme: dark
extracted: 2026-06-14T20:37:12.700Z
generator: design-extractor
---

# DESIGN.md

## Design Summary

Paperclip is an AI agent management platform with a dark, warm-toned design system built on a near-black charcoal canvas (#141413). The hero features a striking sculptural illustration of colorful gradient pill shapes. Typography pairs Inter Tight (display/headings) with Inter (body) and JetBrains Mono (code), all rendered in a warm cream (#F3E6C4, --manila). CTAs use fully-rounded pill buttons with the cream fill against the dark background. The design uses a well-structured CSS variable system with semantic aliases (--bg, --surface, --rule, --ink-t) and a fluid spacing scale via clamp(). The overall aesthetic is bold, warm-dark, and developer-friendly with a distinctive AI-product personality.

## Style Tags

`warm-toned dark canvas`, `pill-radius CTA language`, `gradient-sculpture hero art`, `tight-tracked display type`, `semantic color-variable system`

## Themes

Default: dark

### Dark

| Token | Hex | Role | Context |
|-------|-----|------|---------|
| charcoal | #141413 | primary | Primary page background and navbar fill; --charcoal CSS variable; covers ~17.5% area |
| manila | #f3e6c4 | text | Primary text, headings, nav links, button fill, icon strokes; --manila CSS variable; 1546 hits |
| stone-muted | #9a958a | text | Secondary/muted text, subheadings, captions; 940 hits across footer, header, main |
| dark-surface | #1f1d1a | background | Elevated card/button surfaces, slightly lighter than charcoal; 74 hits in footer zone |
| dark-border | #2f2c28 | border | Navbar bottom border, card borders, dividers; 78 hits; confirmed in navbar probe borderColor |
| bond-white | #ffffff | text | High-contrast text on colored surfaces, icon fills; --bond CSS variable; 110 hits |
| green-success | #22c55e | background | Success state indicators, status badges, glow shadows; 24 hits; --success semantic token |
| amber-warning | #e5a536 | background | Warning state indicators; 6 hits; --warning semantic token |
| dark-raised-surface | #3a3836 | background | Raised surface variant for cards/panels; 6 hits; --color-surface-raised |
| dim-text | #6a6560 | text | Dimmed/disabled text, placeholder text; 24 hits in footer/button zones |

### Light

| Token | Hex | Role | Context |
|-------|-----|------|---------|
| bond-white | #ffffff | background | Primary page background in light mode; --bond / --bg CSS variable |
| manila-cream | #f3e6c4 | text | Hero headline text, CTA button fill, brand accent; --manila; 1546 hits |
| charcoal | #141413 | primary | Primary body text, nav text, button text on light surfaces; --charcoal; 59 hits |
| stone-muted | #9a958a | text | Secondary text, muted labels; 940 hits |
| dark-surface | #1f1d1a | background | Dark card/button surfaces in light mode; 74 hits |
| green-success | #22c55e | background | Success indicators, status glows; --success |
| amber-warning | #e5a536 | background | Warning indicators; --warning |
| border-stone | #2f2c28 | border | Dividers, card borders; 78 hits |

## Typography

| Token | Font | Size | Weight | Line Height | Letter Spacing | Role |
|-------|------|------|--------|-------------|----------------|------|
| hero-display | Inter Tight | 44.8px | 600 | 47.04px | -1.344px | Hero headline — large display text; tight tracking creates compressed, impactful feel |
| section-heading | Inter Tight | 44.8px | 600 | 47.04px | -1.344px | Section-level headings like 'Quickstart'; same scale as hero display |
| nav-label | Inter Tight | 14.4px | 600 | 18px | normal | Navigation links, button labels, small headings; semibold weight for emphasis |
| body-regular | Inter | 16px | 400 | 24.8px | normal | Primary body copy, paragraph text; most frequent tuple (864 hits) |
| body-medium | Inter | 16px | 500 | 22.4px | normal | Emphasized body text, UI labels, button text |
| body-small | Inter | 14.4px | 400 | 23.328px | normal | Secondary body text, captions, metadata |
| code-regular | JetBrains Mono | 12px | 400 | 15.6px | normal | Code blocks, terminal output, inline code |
| code-label | JetBrains Mono | 12px | 500 | 18.6px | 0.96px | Code labels, badges, monospace UI elements with tracked spacing |
| cta-button | Inter | 15.2px | 400 | 23.56px | normal | Primary CTA button text; probe-confirmed at 15.2px |

## Spacing
- xs: 0.5rem (8px)
- sm: 1rem (16px)
- md: 1.5rem (24px)
- lg: clamp(2rem, calc(1.5rem + 1.5vw), 3rem) (32px)
- xl: clamp(3rem, calc(2rem + 3vw), 5rem) (48px)
- 2xl: clamp(4rem, calc(2.5rem + 4.5vw), 7rem) (64px)
- 3xl: clamp(5rem, calc(3rem + 6vw), 10rem) (80px)
- section: clamp(5rem, calc(3rem + 5.5vw), 9rem) (80px)
- section-gap: clamp(2rem, 5vw, 6rem) (32px)
- base-17.6: 17.6px (17.6px)
- base-24: 24px (24px)
- base-12: 12px (12px)
- base-43.2: 43.2px (43.2px)
- base-50: 50px (50px)

## Border Radius
- sm: 4px (4px)
- md: 8px (8px)
- lg: 12px (12px)
- pill: 9999px (9999px)
- large-pill: 999px (999px)
- circle: 100px (100px)

## Fonts

(none)