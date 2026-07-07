---
source: https://www.snapchat.com/
brand: Snapchat
style: Snapchat Web 2024
themes: [light, dark]
default_theme: light
extracted: 2026-06-06T00:31:45.717Z
generator: design-extractor
---

# DESIGN.md

## Design Summary

Snapchat's web presence uses a high-contrast light theme anchored by its iconic #FFFC00 brand yellow, near-black (#121314) primary surfaces, and a clean white page background. The design pairs Avenir Next (primary) with Graphik (secondary) for a friendly yet structured typographic hierarchy. Interaction elements — buttons, pills, and tags — use fully rounded (100px) radii, while inputs use a subtle 5px radius. Navigation is a floating pill with a soft drop shadow. Content is presented in large media cards with overlaid white text, creating an immersive, app-preview-forward layout. The overall density is moderate, with generous spacing and a clear visual hierarchy that bridges marketing and product UI conventions.

## Style Tags

`snap-yellow brand anchor`, `pill-radius interaction language`, `dual-font editorial hierarchy`, `media-immersive content cards`, `high-contrast dark-on-white CTA`

## Themes

Default: light

### Light

| Token | Hex | Role | Context |
|-------|-----|------|---------|
| page-background | #ffffff | background | Main page background, nav background, card surfaces |
| primary-action-/-button-bg | #121314 | text | Primary button backgrounds (Download, Snapchat Ads), nav surface button bg |
| brand-yellow | #fffc00 | text | Snapchat brand color, ghost gradient, footer accents, logo context |
| body-text-/-secondary | #53575b | text | Nav labels, body copy, secondary text throughout |
| primary-text-/-near-black | #000000 | text | Headings, strong text, icon fills, footer text |
| button-text-/-white | #ffffff | text | Text on dark primary buttons, overlaid card headlines |
| nav-border | #e9eaeb | border | Navigation bar bottom border, secondary button hover state |
| secondary-button-bg | #f0f1f2 | background | Secondary/disabled button backgrounds, input fill |
| action-blue | #0096e5 | background | Primary alt button bg (Log in CTA), highlight action color, links |
| card-/-feed-background | #f8f9fb | background | Card backgrounds, feed surface |

### Dark

| Token | Hex | Role | Context |
|-------|-----|------|---------|
| page-background | #ffffff | background | Main page background (dark theme shares same CSSOM data — no distinct dark surface detected) |
| primary-action-/-button-bg | #121314 | text | Primary button backgrounds |
| brand-yellow | #fffc00 | text | Brand accent, logo, footer highlights |
| body-text | #53575b | text | Nav labels, body copy |
| primary-text | #000000 | text | Headings, strong text |
| action-blue | #0096e5 | background | Log in button, highlight action |

## Typography

| Token | Font | Size | Weight | Line Height | Letter Spacing | Role |
|-------|------|------|--------|-------------|----------------|------|
| display-heading | Avenir Next, Helvetica, sans-serif | 48px | 600 | 60px | normal | Hero/display-level headings |
| section-heading | Avenir Next, Helvetica, sans-serif | 28px | 700 | 36px | normal | Section titles, card overlay headlines |
| sub-heading | Avenir Next, Helvetica, sans-serif | 22px | 600 | 28px | normal | Sub-section headings, feature titles |
| body-default | Avenir Next, Helvetica, sans-serif | 16px | 400 | normal | normal | Primary body copy, login form labels |
| body-small | Avenir Next, Helvetica, sans-serif | 14px | 400 | 17px | normal | Secondary body text, descriptions |
| label-medium | Avenir Next, Helvetica, sans-serif | 14px | 500 | 18px | normal | Button labels, nav item labels, interactive labels |
| label-bold | Avenir Next, Helvetica, sans-serif | 14px | 700 | normal | normal | Strong labels, emphasized UI text |
| caption | Avenir Next, Helvetica, sans-serif | 12px | 600 | normal | normal | Captions, badges, small labels |
| nav-label | Graphik, Helvetica, sans-serif | 14px | 400 | normal | normal | Navigation item text, secondary UI labels |
| body-medium-emphasis | Avenir Next, Helvetica, sans-serif | 16px | 500 | 24px | normal | Medium-emphasis body text, feature descriptions |

## Spacing
- spacing-1: 2px (2px)
- spacing-2: 3px (3px)
- spacing-3: 4px (4px)
- spacing-4: 5px (5px)
- spacing-5: 6px (6px)
- spacing-6: 7px (7px)
- spacing-7: 8px (8px)
- spacing-8: 10px (10px)
- spacing-9: 12px (12px)
- spacing-10: 15px (15px)
- spacing-11: 16px (16px)
- spacing-12: 20px (20px)
- spacing-13: 29px (29px)
- spacing-14: 30px (30px)
- spacing-15: 35px (35px)
- spacing-16: 40px (40px)
- spacing-17: 43px (43px)

## Border Radius
- radius-input: 5px (5px)
- radius-nav: 6px (6px)
- radius-card: 8px (8px)
- radius-tag: 20px (20px)
- radius-pill: 100px (100px)

## Fonts
- **Avenir Next** — custom
- **Graphik** — custom
- **Helvetica** — system
- **Arial** — system