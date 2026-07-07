---
source: https://neon.com/
brand: Neon
style: Neon Dark-First Developer
themes: [dark, light]
default_theme: dark
extracted: 2026-06-30T13:12:03.014Z
generator: design-extractor
---

# DESIGN.md

## Design Summary

Neon's design system is a dark-first developer brand built on a near-black canvas (#000000, #18191b) with a vivid neon-green primary (#00e599) and a supporting mid-green (#34d59a). The typographic system pairs Inter (UI/body) with GeistMono (code/data), both with tight negative letter-spacing. Spacing follows a 4px base grid. Border radius is uniformly minimal at 4px. Elevation is achieved through border contrast rather than shadows, with a single ambient drop-shadow used sparingly. The hero section features a full-bleed animated data-visualization background, reinforcing the database/infrastructure brand identity.

## Style Tags

`dark-first immersive hero`, `monospace-accented dual-font`, `neon-green brand signal on near-black surface`, `tight 4px radius language`, `flat-shadow elevation with border-contrast depth`

## Themes

Default: dark

### Dark

| Token | Hex | Role | Context |
|-------|-----|------|---------|
| background-base | #000000 | background | Primary page background, hero section, nav overlay |
| surface-elevated | #18191b | background | Card and link group backgrounds, slightly elevated surfaces |
| surface-mid | #242628 | background | Secondary surface, footer elements, subtle containers |
| border-subtle | #303236 | border | Hairline dividers, nav link bottom borders, card outlines |
| text-primary | #ffffff | text | All primary headings, body text, nav labels, button labels |
| text-secondary | #94979e | text | Secondary body text, metadata, muted labels |
| text-tertiary | #797d86 | text | Code comments, placeholder text, de-emphasized labels |
| text-muted | #61646b | text | Disabled states, very muted secondary text |
| brand-green | #00e599 | text | Primary CTA buttons, brand highlights, logo accent |
| brand-green-mid | #34d59a | text | Syntax keyword highlighting, secondary green accents |
| brand-green-dark | #2c6d4c | background | Localized surface accent, footer decorative elements |
| error-red | #ff3621 | text | Error states, destructive action indicators |
| border-default | #c9cbcf | border | Visible borders on interactive elements in lighter contexts |

### Light

| Token | Hex | Role | Context |
|-------|-----|------|---------|
| background-base | #ffffff | background | Page background in light mode contexts |
| surface-subtle | #f9fafa | background | Subtle off-white surface for cards and sections |
| text-primary | #000000 | text | Primary headings and body text on light backgrounds |
| text-secondary | #94979e | text | Secondary and muted text on light surfaces |
| border-subtle | #e4e5e7 | border | Light-mode hairline dividers and card borders |
| brand-green | #00e599 | text | Primary CTA, brand accent on light backgrounds |
| brand-green-mid | #34d59a | text | Secondary green accent, syntax highlighting |
| surface-green-tint | #e4f1eb | background | Light green tinted surface for callouts or highlights |

## Typography

| Token | Font | Size | Weight | Line Height | Letter Spacing | Role |
|-------|------|------|--------|-------------|----------------|------|
| display-hero | Inter | 68px | 400 | 1.0 | -1.92px | Hero headline — large display text for primary page statement |
| heading-xl | Inter | 48px | 400 | 54px | -1.92px | Section headings, major content titles |
| heading-lg | Inter | 18px | 500 | 18px | -0.13px | Card titles, sub-section headings, nav group labels |
| body-base | Inter | 16px | 400 | 24px | normal | Primary body copy, nav items, general UI text |
| body-sm | Inter | 15px | 400 | 22.5px | -0.3px | Secondary body text, button labels, compact UI text |
| label-sm | Inter | 13px | 400 | 16.25px | -0.13px | Metadata labels, tags, small captions |
| code-base | GeistMono | 16px | 400 | 16px | -0.32px | Primary monospace code, terminal output, data display |
| code-lg | GeistMono | 20px | 400 | 27.5px | -0.32px | Larger code blocks, featured code snippets |
| code-sm | GeistMono | 14px | 400 | 23.1px | -0.28px | Inline code, small terminal text, compact data |
| code-xs | GeistMono | 12px | 400 | 12px | -0.32px | Micro labels, version numbers, compact code annotations |

## Spacing
- space-1: 4px (4px)
- space-2: 8px (8px)
- space-3: 12px (12px)
- space-4: 16px (16px)
- space-5: 20px (20px)
- space-6: 24px (24px)
- space-7: 28px (28px)
- space-8: 32px (32px)
- space-9: 36px (36px)
- space-10: 64px (64px)
- space-11: 80px (80px)
- space-12: 160px (160px)
- space-13: 240px (240px)

## Border Radius
- radius-sm: 4px (4px)
- radius-xl: 12px (12px)

## Fonts
- **Inter** — custom
- **GeistMono** — custom