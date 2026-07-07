---
source: https://railway.com/
brand: Railway
style: Cosmic Developer Platform
themes: [dark, light]
default_theme: dark
extracted: 2026-05-30T21:23:46.223Z
generator: design-extractor
---

# DESIGN.md

## Design Summary

Railway's design system features a dark cosmic theme with deep space backgrounds, purple accent colors, and clean typography. The interface emphasizes developer productivity with a sophisticated dark UI, subtle gradients, and carefully crafted spacing that creates a premium cloud platform experience.

## Style Tags

`dark`, `cosmic`, `developer-focused`, `modern`, `technical`

## Themes

Default: dark

### Dark

| Token | Hex | Role | Context |
|-------|-----|------|---------|
| background-primary | #33323e | background | Main background color for dark surfaces and containers |
| background-secondary | #f7f7f8 | background | Light background areas and content surfaces |
| text-primary | #ffffff | text | Primary text color on dark backgrounds |
| text-secondary | #0b0b0f | text | Primary text color on light backgrounds |
| text-muted | #a1a0ab | text | Secondary and muted text content |
| purple-primary | #853bce | primary | Primary brand color for buttons and accents |
| border-default | #545260 | border | Default border color for components |
| surface-dark | #13111c | background | Darker surface areas and overlays |

### Light

| Token | Hex | Role | Context |
|-------|-----|------|---------|
| background-primary | #ffffff | background | Main background color for light surfaces |
| background-secondary | #f7f7f8 | background | Secondary background areas |
| text-primary | #0b0b0f | text | Primary text color on light backgrounds |
| text-secondary | #33323e | text | Secondary text content |
| text-muted | #a1a0ab | text | Muted and tertiary text |
| purple-primary | #853bce | primary | Primary brand color for interactive elements |
| border-default | #dcdce0 | border | Default border color for light theme |
| surface-elevated | #ffffff | background | Elevated surfaces and cards |

## Typography

| Token | Font | Size | Weight | Line Height | Letter Spacing | Role |
|-------|------|------|--------|-------------|----------------|------|
| body-default | Inter | 16px | 400 | 26px | normal | Primary body text and interface labels |
| body-small | Inter | 14px | 400 | 22.75px | normal | Secondary text and smaller interface elements |
| body-medium | Inter | 14px | 500 | 22.75px | normal | Emphasized body text and labels |
| heading-large | Inter | 24px | 400 | 32px | normal | Large headings and hero text |
| heading-medium | Inter | 18px | 400 | 27px | normal | Section headings and medium emphasis |
| code-default | JetBrains Mono | 12px | 400 | 19.5px | normal | Code blocks and monospace content |
| code-medium | JetBrains Mono | 13px | 400 | 21.125px | normal | Larger code content and terminal text |
| caption | Inter | 11px | 400 | 17.875px | -0.22px | Small captions and metadata |

## Spacing
- xs: 4px (4px)
- sm: 8px (8px)
- md: 12px (12px)
- lg: 16px (16px)
- xl: 24px (24px)
- 2xl: 32px (32px)
- 3xl: 40px (40px)
- 4xl: 48px (48px)
- 5xl: 64px (64px)
- 6xl: 80px (80px)
- 7xl: 96px (96px)
- 8xl: 128px (128px)

## Border Radius
- sm: 4px (4px)
- md: 6px (6px)
- lg: 8px (8px)
- xl: 12px (12px)
- 2xl: 16px (16px)
- full: 9999px (9999px)

## Fonts
- **Inter** — google
- **JetBrains Mono** — google
- **Inter Tight** — google
- **IBM Plex Serif** — google

## Component Patterns
- **Hero Section**: Large cosmic background with centered content, featuring main heading, subtitle, and primary action buttons
- **Navigation Bar**: Top navigation with logo, menu items, and authentication actions using consistent spacing and typography
- **Dashboard Interface**: Dark-themed dashboard with sidebar navigation, main content area, and status indicators
- **Button Components**: Primary and secondary buttons with purple accent colors, consistent border radius, and hover states
- **Card Components**: Content cards with subtle borders, consistent padding, and dark/light theme variations
- **Status Indicators**: Deployment status and system health indicators with color-coded states and clear typography