---
source: https://www.lassie.ai/
brand: Lassie
style: Lassie AI — Warm Editorial Medical
themes: [light]
default_theme: light
extracted: 2026-06-15T12:08:12.684Z
generator: design-extractor
---

# DESIGN.md

## Design Summary

Lassie is an AI-powered medical admin platform targeting doctors. The design leads with a cinematic full-bleed hero photograph overlaid with large serif italic type (abcMarist), creating an editorial, human-first impression. The surface palette is warm stone (#f9f8f5) rather than clinical white, softening the medical context. Navigation uses a floating pill-shaped bar with rounded corners. Typography mixes the expressive abcMarist serif for headings with DM Sans for body and DM Mono for data labels. No box shadows are used — depth is achieved through surface color contrast and border hairlines. The overall tone is warm, trustworthy, and editorial.

## Style Tags

`serif-led hero typography`, `warm stone surface palette`, `full-bleed cinematic photography`, `pill-nav with soft radius language`, `flat-shadow elevation strategy`

## Colors

| Token | Hex | Role | Context |
|-------|-----|------|---------|
| stone-100-—-surface-base | #f9f8f5 | background | Primary page and main content background; body and main element background-color |
| pure-black-—-primary-text | #000000 | text | Primary body text, nav links, and default foreground; highest frequency text color |
| white-—-overlay-text-&-surface | #ffffff | text | Hero headline text overlaid on dark photography; also used for card surfaces and nav background |
| grey-200-—-border-hairline | #e5e7eb | primary | Universal border color on nav, inputs, cards, and dividers; highest count in CSSOM |
| black-800-—-deep-text | #1a1613 | text | Footer and secondary text; warm near-black for body copy on stone surfaces |
| grey-600-—-muted-text | #666666 | text | Subdued labels, captions, and secondary UI text |
| stone-500-—-warm-accent-border | #e3ddcf | border | Warm-toned dividers and subtle surface accents in header and footer zones |
| get-started-cta-—-primary-action | #000000 | text | Primary CTA button ('Get started') uses black fill with white text, serving as the action-primary color |

## Typography

| Token | Font | Size | Weight | Line Height | Letter Spacing | Role |
|-------|------|------|--------|-------------|----------------|------|
| heading-1-—-hero-display | abcMarist | 76.928px | 350 | 73.08px | -1.539px | Hero headline; full-bleed cinematic overlay text |
| heading-2-—-section-title | abcMarist | 51.84px | 350 | 54.43px | -0.518px | Section headings and feature titles |
| heading-3-—-sub-section | abcMarist | 22.2px | 350 | 24.42px | -0.2px | Sub-section labels and card headings |
| body-—-default | dmSans | 17px | 400 | 22.1px | normal | Primary body copy and nav link text |
| body-—-small | dmSans | 14px | 400 | 18.2px | 0.07px | Secondary body text, captions, and footer copy |
| body-—-large | dmSans | 20px | 400 | 26px | 0.2px | Lead paragraph and CTA supporting text |
| input-—-field-text | dmSans | 16px | 400 | 24px | normal | Email input field placeholder and value text |
| mono-—-data-label | dmMono | 14px | 400 | 19.6px | -0.14px | Metric labels, payment amounts, and data callouts |
| mono-—-micro | dmMono | 10px | 400 | 14px | -0.1px | Micro data labels and badge text |

## Spacing
- xs: 4px (4px)
- sm: 6px (6px)
- md-sm: 8px (8px)
- md: 12px (12px)
- base: 14px (14px)
- lg: 16px (16px)
- xl: 20px (20px)
- 2xl: 24px (24px)
- 3xl: 32px (32px)
- 4xl: 40px (40px)
- 5xl: 80px (80px)
- 6xl: 100px (100px)
- 7xl: 160px (160px)
- container: 1760px (1760px)

## Border Radius
- xs: 4px (4px)
- sm: 12px (12px)
- md: 16px (16px)
- lg: 18px (18px)
- xl: 32px (32px)
- pill: 64px (64px)

## Fonts
- **abcMarist** — custom
- **dmSans** — custom
- **dmMono** — custom

## Component Patterns
- **Floating Pill Navigation**: A horizontally centered floating nav bar with a pill/capsule shape, hairline border, and transparent/white background. Contains logo mark, text links, and a Login CTA button.
- **Hero Section**: Full-bleed cinematic photograph background with centered overlay text. Large abcMarist serif headline (regular + italic) with DM Sans supporting copy and a split email-capture CTA below.
- **Email Capture CTA**: A split pill-shaped form with an email input on the left and a filled black 'Get started' button on the right. Both share a unified pill container with 64px border-radius.
- **Metric Badge**: An inline badge or pill showing a real-time metric (e.g. 'Posted $12,430 in payments') using DM Mono for the numeric value. Appears below hero subheading.
- **Nav Link**: Text navigation links within the floating pill nav. Uses DM Sans at 14px with normal weight.
- **Login Button**: A secondary-style button in the nav bar for Login action. Appears as a pill-shaped outlined or filled button.