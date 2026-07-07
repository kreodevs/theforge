---
source: https://theonion.com/
brand: The Onion
style: The Onion Editorial
themes: [light]
default_theme: light
extracted: 2026-06-06T01:35:17.418Z
generator: design-extractor
---

# DESIGN.md

## Design Summary

The Onion's design system is a digitized satirical newspaper: bold condensed gothic headlines in black, a distinctive forest-green (#006b3a) brand accent used for section labels, trending badges, and CTAs, all set against a stark white/light-gray canvas. Typography is the primary design tool — Adobe Fonts condensed and semi-condensed grotesques (tablet-gothic, rocky-condensed) dominate headlines while utopia-std-caption handles body copy. The layout is information-dense with tight card grids, bottom-border article separators, and near-zero border radii on structural elements. Elevation is minimal — a few subtle shadows on overlays only.

## Style Tags

`satirical-green-brand-identity`, `condensed-gothic-headline-hierarchy`, `high-contrast-black-on-white-editorial`, `newspaper-grid-with-thumbnail-cards`, `flat-zero-radius-article-layout`

## Colors

| Token | Hex | Role | Context |
|-------|-----|------|---------|
| brand-green | #006b3a | text | Section labels, trending badge background, CTA buttons, links, logo accent, nav highlights |
| editorial-black | #000000 | text | Primary body text, headlines, nav links, borders, logo wordmark |
| page-white | #ffffff | background | Page background, card surfaces, input backgrounds, modal backgrounds |
| divider-gray | #e6e6e6 | border | Article card bottom borders, section dividers, hairline separators |
| muted-gray | #676767 | text | Secondary text, bylines, metadata, timestamps |
| deep-navy | #0a112d | text | Alternate dark text in header and footer contexts |
| mint-tint | #94d1b4 | background | Secondary brand accent, subtle highlights |
| light-gray-surface | #f3f3f3 | background | Alternate section backgrounds, subtle surface fills |

## Typography

| Token | Font | Size | Weight | Line Height | Letter Spacing | Role |
|-------|------|------|--------|-------------|----------------|------|
| article-headline | tablet-gothic-semi-condensed | 21px | 600 | 23.1px | normal | Primary article card headline, story titles in sidebar |
| section-label-/-nav | tablet-gothic-semi-condensed | 15.5px | 700 | 23.25px | normal | Navigation items, section category labels, trending tags |
| body-copy | utopia-std-caption | 16px | 400 | 24px | normal | Article body text, consent dialog copy, paragraph content |
| deck-/-subhead | tablet-gothic-semi-condensed | 19.75px | 400 | 29.63px | normal | Article deck text, secondary headlines |
| hero-headline | rocky-compressed | 35.5px | 400 | 39.05px | normal | Large feature story headlines, hero display text |
| condensed-label | rocky-condensed | 21px | 400 | 23.11px | normal | Ticker/newswire labels, compact headline variants |
| ui-label-small | tablet-gothic-semi-condensed | 10px | 700 | 15px | normal | Micro labels, badges, category chips |
| ui-body | Open Sans | 16px | 400 | normal | normal | Consent dialogs, cookie banners, third-party UI elements |

## Spacing
- xs: 4px (4px)
- sm: 8px (8px)
- md: 12px (12px)
- base: 16px (16px)
- lg: 24px (24px)
- xl: 32px (32px)
- 2xl: 48px (48px)
- 3xl: 56px (56px)

## Border Radius
- none: 0px (0px)
- sm: 4px (4px)
- md: 8px (8px)
- lg: 16px (16px)
- pill: 9999px (9999px)
- full: 1000px (1000px)

## Fonts
- **tablet-gothic-semi-condensed** — adobe
- **tablet-gothic-condensed** — adobe
- **rocky-condensed** — adobe
- **rocky-compressed** — adobe
- **utopia-std-caption** — adobe
- **Open Sans** — google
- **Arial** — system