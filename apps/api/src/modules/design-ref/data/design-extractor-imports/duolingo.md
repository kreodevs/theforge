---
source: https://www.duolingo.com/
brand: Duolingo
style: Duolingo Light
themes: [light]
default_theme: light
extracted: 2026-06-10T19:36:45.305Z
generator: design-extractor
---

# DESIGN.md

## Design Summary

Duolingo's homepage uses a white canvas with a bold brand-green (#58cc02) primary CTA, a custom rounded sans-serif typeface (Duolingo Sans), and a playful illustration-led hero. The layout is centered and spacious, with two-button CTA stacks, a language carousel at the bottom, and minimal use of shadows or decorative borders. Typography relies heavily on weight contrast (w500 body, w700 labels/headings) and uppercase letter-spaced labels. The overall feel is friendly, accessible, and gamified.

## Style Tags

`brand-green-dominant`, `playful-rounded-buttons`, `uppercase-label-tracking`, `character-illustration-hero`, `flat-elevation-no-shadows`

## Colors

| Token | Hex | Role | Context |
|-------|-----|------|---------|
| brand-green | #58cc02 | text | Primary CTA button fill (GET STARTED), logo accent, key interactive elements |
| light-green-tint | #a5ed6e | text | Button hover states, progress indicators, secondary green accents |
| surface-white | #ffffff | background | Page background, button text on green CTA, card surfaces |
| primary-text | #3c3c3c | text | Body text, navigation labels, footer text — dominant text color across the page |
| secondary-text | #777777 | text | Subdued labels, footer links, secondary navigation items |
| muted-text | #4b4b4b | text | Heading text (h1), slightly lighter than primary body text |
| disabled-/-placeholder | #afafaf | border | Disabled button text, placeholder states, inactive carousel arrows |
| sky-blue | #1cb0f6 | text | Secondary button text (I ALREADY HAVE AN ACCOUNT), link accents, macaw color token |
| pale-green-tint | #d7ffb8 | background | Light green background tints for progress/streak panels |
| border-subtle | #e5e5e5 | border | Hairline dividers, card outlines, subtle separators |

## Typography

| Token | Font | Size | Weight | Line Height | Letter Spacing | Role |
|-------|------|------|--------|-------------|----------------|------|
| hero-heading | duolingo-sans | 32px | 700 | normal | normal | Primary hero headline — 'The free, fun, and effective way to learn a language!' |
| body-default | duolingo-sans | 17px | 500 | 20px | normal | Primary body text, navigation items, general UI text — most frequent tuple |
| button-label | duolingo-sans | 15px | 700 | 20px | 0.8px | CTA button labels, uppercase-tracked interactive labels (GET STARTED, I ALREADY HAVE AN ACCOUNT) |
| small-label | duolingo-sans | 13px | 700 | 16px | normal | Small UI labels, badges, language carousel items |
| subheading | duolingo-sans | 19px | 700 | 26.6px | normal | Section subheadings, feature callouts |
| nav-link | duolingo-sans | 17px | 500 | 24px | normal | Navigation links, footer links |
| icon-font | feather | 48px | 700 | normal | normal | Icon glyphs (carousel arrows, UI icons) |

## Spacing
- xs: 8px (8px)
- sm: 10px (10px)
- md: 12px (12px)
- base: 16px (16px)
- lg: 24px (24px)
- xl: 32px (32px)
- 2xl: 40px (40px)
- 3xl: 48px (48px)
- 4xl: 64px (64px)
- 5xl: 96px (96px)
- section: 146px (146px)

## Border Radius
- button: 12px (12px)
- badge: 2px (2px)

## Fonts
- **duolingo-sans** — custom
- **feather** — custom