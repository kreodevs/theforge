---
source: https://supabase.com/
brand: Supabase
style: Supabase Design System
themes: [light, dark]
default_theme: dark
extracted: 2026-06-25T16:38:34.198Z
generator: design-extractor
---

# DESIGN.md

## Design Summary

Supabase uses a dual-theme (light/dark) developer-focused design system anchored by a single custom typeface — Circular — across all text roles. The brand identity is expressed through a vivid green (#3ecf8e / #3fcf8e) used exclusively for accent text, CTA buttons, and logo marks against near-black or near-white surfaces. Elevation is communicated entirely through border contrast (1px borders in #2e2e2e dark / #dfdfdf light) rather than shadows, creating a flat, structured aesthetic. Spacing follows an 8px base grid with consistent multiples (8, 16, 24, 32, 96px). Border radii cluster at 6–8px for interactive elements and 12–16px for cards and panels.

## Style Tags

`brand-green-accent-on-dark`, `single-typeface-circular`, `flat-border-defined-elevation`, `8px-base-grid-rhythm`, `dual-theme-symmetric`

## Themes

Default: dark

### Light

| Token | Hex | Role | Context |
|-------|-----|------|---------|
| background-base | #fcfcfc | background | Primary page background in light mode |
| surface-card | #ffffff | background | Card and panel surface fills in light mode |
| text-primary | #171717 | text | Primary body and heading text in light mode |
| text-secondary | #525252 | text | Secondary and subdued text in light mode |
| text-muted | #707070 | text | Muted/tertiary text, captions, and metadata in light mode |
| border-default | #dfdfdf | primary | Default border for nav, cards, dividers, and inputs in light mode |
| border-subtle | #c7c7c7 | border | Subtle input and component borders in light mode |
| brand-green | #3fcf8e | text | Primary CTA button fill, hero headline accent, logo mark |
| brand-green-light | #72e3ad | background | Hover states and lighter green tints on brand elements |

### Dark

| Token | Hex | Role | Context |
|-------|-----|------|---------|
| background-base | #121212 | background | Primary page background in dark mode |
| surface-card | #171717 | background | Card and panel surface fills in dark mode |
| surface-elevated | #242424 | background | Elevated surface or hover state backgrounds in dark mode |
| text-primary | #fafafa | text | Primary body and heading text in dark mode |
| text-secondary | #b4b4b4 | text | Secondary and subdued text in dark mode |
| text-muted | #898989 | text | Muted/tertiary text, captions, and metadata in dark mode |
| border-default | #2e2e2e | primary | Default border for nav, cards, dividers, and inputs in dark mode |
| border-subtle | #393939 | border | Subtle secondary borders in dark mode |
| brand-green | #3ecf8e | text | Primary CTA button fill, hero headline accent, logo mark in dark mode |
| brand-green-dark | #006239 | background | Deep green tint used for brand button hover or pressed states |

## Typography

| Token | Font | Size | Weight | Line Height | Letter Spacing | Role |
|-------|------|------|--------|-------------|----------------|------|
| hero-display | Circular | 72px | 400 | 72px | normal | Hero headline — largest display text on the page |
| section-heading | Circular | 36px | 400 | 43.2px | normal | Section-level headings and feature titles |
| subheading | Circular | 24px | 400 | 32px | -0.16px | Card titles and sub-section headings |
| large-body | Circular | 18px | 400 | 28px | normal | Hero body copy and introductory paragraphs |
| body-default | Circular | 16px | 400 | 24px | normal | Default body text, nav items, and general content |
| body-medium | Circular | 14px | 400 | 20px | normal | Secondary body text, descriptions, and metadata |
| label-medium | Circular | 14px | 500 | 20px | normal | Button labels, nav links, and interactive element labels |
| label-small | Circular | 12px | 400 | 16px | normal | Badges, tags, and small UI labels |
| code | Source Code Pro | 12px | 400 | 16px | 1.2px | Inline code snippets and code block content |

## Spacing
- space-1: 4px (4px)
- space-2: 8px (8px)
- space-3: 12px (12px)
- space-4: 16px (16px)
- space-5: 20px (20px)
- space-6: 24px (24px)
- space-8: 32px (32px)
- space-10: 40px (40px)
- space-12: 48px (48px)
- space-16: 64px (64px)
- space-24: 96px (96px)
- space-32: 128px (128px)

## Border Radius
- radius-sm: 6px (6px)
- radius-md: 8px (8px)
- radius-lg: 12px (12px)
- radius-xl: 16px (16px)
- radius-pill: 11px (11px)

## Fonts
- **Circular** — custom
- **Source Code Pro** — google