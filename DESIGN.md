---
name: stackscan
description: A premium, dark-mode glassmorphic GitHub profile technology scanner.
colors:
  primary: "#06b6d4"
  secondary: "#8b5cf6"
  accent: "#f43f5e"
  bg-dark: "#09090b"
  card-glass: "rgba(24, 24, 27, 0.6)"
  border-glass: "rgba(255, 255, 255, 0.08)"
  text-primary: "#f4f4f5"
  text-secondary: "#a1a1aa"
  text-muted: "#71717a"
typography:
  display:
    fontFamily: "Outfit, Inter, sans-serif"
    fontSize: "clamp(2rem, 5vw, 2.8rem)"
    fontWeight: 800
    lineHeight: 1.15
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.6
  code:
    fontFamily: "Fira Code, SFMono-Regular, Consolas, monospace"
    fontSize: "0.85rem"
    fontWeight: 400
rounded:
  sm: "6px"
  md: "12px"
  lg: "16px"
  full: "9999px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-6: "24px"
  space-8: "32px"
  space-12: "48px"
  space-16: "64px"
components:
  card:
    backgroundColor: "{colors.card-glass}"
    backdropFilter: "blur(12px)"
    border: "1px solid {colors.border-glass}"
    borderRadius: "{rounded.lg}"
    padding: "{spacing.space-8}"
  badge:
    borderRadius: "{rounded.full}"
    padding: "{spacing.space-1} {spacing.space-3}"
    fontSize: "0.8rem"
    fontWeight: 600
---

# Design System: StackScan

## 1. Overview

**Creative North Star: "Futuristic Glassmorphic Console"**

A high-fidelity developer utility featuring deep space-black backgrounds, crisp neon highlights, and translucent glass-like cards. The interface feels premium, precise, and fast. Spacing is comfortable but compact, optimized for data density and quick scanning.

### Key Characteristics:
- Semi-transparent glass container overlays (`backdrop-filter: blur(12px)`).
- Vibrant gradient text headers (cyan to violet to rose).
- Precise, thin card borders with subtle inner box-shadow highlights.
- Interactive custom SVG visual analytics charts.
- Dark theme optimized for developer comfort.

## 2. Colors

A dark, high-contrast palette anchored in cool zinc tones and accented with vibrant neon primaries.

### Core Colors
- **Cyan (Primary)** (`#06b6d4`): Brand primary, highlights, main buttons.
- **Violet (Secondary)** (`#8b5cf6`): Gradients, scan CTA accents.
- **Rose (Accent)** (`#f43f5e`): High-severity errors, deleted/decreased counters.
- **Space Black (Background)** (`#09090b`): Document base color.
- **Zinc Dark (Card)** (`#18181b`): Underlying opaque block base.

### Named Rules
- **The Glass Ratio**: All card surfaces must utilize `{colors.card-glass}` with backdrop-filter blur. Opaque surfaces are only used for text input fields.
- **Neon Glows**: Primary elements may feature soft glow box shadows using `{colors.primary}` or `{colors.secondary}` with 20% opacity.

## 3. Typography

Modern neo-grotesque display headers paired with clean sans-serif body copy and monospace log outputs.

### Typographic System
- **Display titles**: `Outfit` or `Inter`, high weight (800), tight letter-spacing.
- **Body text**: `Inter`, balanced readability.
- **Logs/Console**: `Fira Code` or system monospace.

## 4. Spacing & Spacers

Layout spacing uses a modular scale of 4px. Component padding uses `{spacing.space-8}` (32px) for card containers and `{spacing.space-4}` (16px) for item rows.
