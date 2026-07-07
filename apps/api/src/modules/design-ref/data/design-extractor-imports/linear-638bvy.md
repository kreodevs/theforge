---
source: https://linear.app/?utm_source=chatgpt.com
brand: Linear
style: Linear Dark System
themes: [dark, light]
default_theme: dark
extracted: 2026-06-24T13:50:24.765Z
generator: design-extractor
---

# DESIGN.md

## Design Summary

Linear's design system is a dark-first, high-density product UI built for engineering teams. The surface palette anchors on near-black (#08090a, #0f1011) with layered dark grays for sidebar, card, and panel differentiation. Typography is exclusively Inter Variable with precise negative letter-spacing at display sizes and Berkeley Mono for inline code. The radius language is deliberately small (2–6px dominant) with pill shapes reserved for badges and status chips. Elevation is expressed through subtle 1px inset borders and low-opacity drop shadows rather than dramatic layering. The primary CTA color is Linear's signature indigo (#5e6ad2), used on the Sign Up button and key links.

## Style Tags

`dark-first near-black surface`, `variable-weight Inter hierarchy`, `micro-radius component geometry`, `information-dense sidebar shell`, `monospace code-inline accent`

## Themes

Default: dark

### Dark

| Token | Hex | Role | Context |
|-------|-----|------|---------|
| background-primary | #08090a | background | Page-level background, deepest surface layer |
| background-secondary | #0f1011 | background | Secondary surface, panel and card fills |
| background-elevated | #23252a | background | Elevated panels, sidebar, and modal surfaces |
| text-primary | #f7f8f8 | text | Primary headings and body text on dark surfaces |
| text-secondary | #d0d6e0 | text | Secondary labels, nav items, subheadings |
| text-tertiary | #8a8f98 | text | Placeholder text, muted metadata, timestamps |
| text-quaternary | #62666d | text | Disabled states, faintest UI labels |
| border-subtle | #e2e4e7 | border | Hairline dividers and subtle borders |
| brand-indigo | #5e6ad2 | primary | Primary CTA button (Sign Up), key interactive links |
| white-surface | #ffffff | background | Toast/notification backgrounds, modal overlays |

### Light

| Token | Hex | Role | Context |
|-------|-----|------|---------|
| background-primary | #f7f8f8 | background | Page-level background in light contexts |
| text-primary | #08090a | text | Primary text on light surfaces |
| text-secondary | #d0d6e0 | text | Secondary labels and nav items |
| text-tertiary | #8a8f98 | text | Muted metadata and placeholder text |
| text-quaternary | #62666d | text | Disabled and faintest labels |
| brand-indigo | #5e6ad2 | primary | Primary CTA and interactive accent |
| border-default | #e2e4e7 | border | Component borders and dividers |
| white | #ffffff | background | Card and modal surfaces |

## Typography

| Token | Font | Size | Weight | Line Height | Letter Spacing | Role |
|-------|------|------|--------|-------------|----------------|------|
| display-hero | Inter Variable | 64px | 510 | 1.1 | -0.88px | Hero headline (h1), largest display text |
| title-1 | Inter Variable | 40px | 510 | 44px | -0.88px | Section headings, major titles |
| title-2 | Inter Variable | 18px | 400 | 28.8px | -0.165px | Sub-section headings |
| body-regular | Inter Variable | 15px | 400 | 24px | -0.165px | Primary body copy, paragraph text |
| body-base | Inter Variable | 16px | 400 | 24px | normal | Default UI text, nav items |
| label-medium | Inter Variable | 13px | 510 | 19.5px | -0.13px | Sidebar nav labels, button labels, tags |
| label-small | Inter Variable | 12px | 510 | 16.8px | normal | Compact labels, badges, metadata chips |
| caption | Inter Variable | 10px | 510 | 15px | normal | Micro labels, status indicators |
| code-inline | Berkeley Mono | 14px | 400 | 24px | normal | Inline code snippets, variable names in issue descriptions |
| nav-item | Inter Variable | 13px | 400 | 19.5px | -0.13px | Navigation item text |

## Spacing
- spacing-1: 2px (2px)
- spacing-2: 4px (4px)
- spacing-3: 6px (6px)
- spacing-4: 8px (8px)
- spacing-5: 12px (12px)
- spacing-6: 16px (16px)
- spacing-7: 20px (20px)
- spacing-8: 24px (24px)
- spacing-9: 32px (32px)
- spacing-10: 48px (48px)
- spacing-11: 96px (96px)

## Border Radius
- radius-xs: 2px (2px)
- radius-sm: 4px (4px)
- radius-md: 6px (6px)
- radius-lg: 8px (8px)
- radius-xl: 12px (12px)
- radius-2xl: 16px (16px)
- radius-pill: 9999px (9999px)

## Fonts
- **Inter Variable** — custom
- **Berkeley Mono** — custom