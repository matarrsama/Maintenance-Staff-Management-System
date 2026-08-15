---
name: Clinical Precision System
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#434656'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#737688'
  outline-variant: '#c3c5d9'
  surface-tint: '#004ced'
  primary: '#003ec7'
  on-primary: '#ffffff'
  primary-container: '#0052ff'
  on-primary-container: '#dfe3ff'
  inverse-primary: '#b7c4ff'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#005479'
  on-tertiary: '#ffffff'
  tertiary-container: '#006d9c'
  on-tertiary-container: '#cee9ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b7c4ff'
  on-primary-fixed: '#001452'
  on-primary-fixed-variant: '#0038b6'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#c9e6ff'
  tertiary-fixed-dim: '#89ceff'
  on-tertiary-fixed: '#001e2f'
  on-tertiary-fixed-variant: '#004c6e'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 30px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 32px
  xl: 48px
  gutter: 20px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style

This design system is built for the high-stakes environment of hospital maintenance and healthcare management. The aesthetic is **Corporate Modern** with a focus on functional utility and clinical cleanliness. It prioritizes reliability and speed of information processing through a structured, systematic approach.

The interface evokes a sense of calm authority. By utilizing wide margins, high-contrast typography, and a "safety-first" color palette, the system ensures that maintenance staff and healthcare administrators can identify critical issues instantly. The visual language is intentionally restrained to reduce cognitive load during emergency scenarios, favoring logical grouping over decorative elements.

## Colors

The palette is anchored by a deep **Vibrant Blue** (`#0052FF`) used for primary actions and navigation, mirroring the clinical reliability of healthcare software. 

- **Surface Strategy:** We use a tiered white and light-grey system. The base background is a cool-tinted off-white, while primary containers use pure white to pop from the background.
- **Semantic Colors:** Status indicators are strictly enforced. **Pending** uses a warm amber for caution, **Approved/Completed** uses a medical emerald green, and **Denied/Critical** uses a high-visibility red.
- **Neutrals:** A range of Slate grays is used for secondary text and borders to maintain a professional, de-saturated environment that doesn't distract from color-coded status alerts.

## Typography

The typography system uses a dual-sans approach to balance modern aesthetics with technical precision.

- **Headlines:** **Hanken Grotesk** provides a sharp, contemporary geometric feel that establishes clear section hierarchy.
- **Body:** **Inter** is the workhorse font, selected for its exceptional legibility in data-dense tables and maintenance logs.
- **Labels & Metadata:** **JetBrains Mono** is used sparingly for IDs, timestamps, and technical codes (e.g., equipment serial numbers) to provide a distinct "technical" look that separates data from prose.

Hierarchy is reinforced through weight (Bold for headers) and color (Slate-900 for primary text, Slate-500 for secondary details).

## Layout & Spacing

The design system utilizes a **Fixed-Fluid Hybrid Grid**. 
- **Navigation:** A fixed left-hand sidebar (260px) houses the primary app navigation.
- **Content Area:** A fluid 12-column grid for the main stage, with a maximum content width of 1440px to prevent excessive line lengths on ultra-wide monitors.
- **Rhythm:** An 8px linear scale governs all padding and margins. 
- **Density:** For maintenance logs and equipment lists, a "Compact" mode is preferred, reducing vertical padding in table rows to 12px to maximize information density. For dashboard summaries, a "Spacious" setting (24px padding) is used to improve scannability.

## Elevation & Depth

To maintain a "Clinical" feel, this design system avoids heavy shadows in favor of **Tonal Layering** and **Low-Contrast Outlines**.

- **Level 0 (Background):** Slate-50. Used for the global application background.
- **Level 1 (Cards/Containers):** Pure White (#FFFFFF) with a 1px border in Slate-200. No shadow.
- **Level 2 (Active/Hover):** Pure White with a soft, 10% opacity blue-tinted shadow (`0px 4px 12px rgba(0, 82, 255, 0.1)`) to indicate interactivity.
- **Level 3 (Modals/Popovers):** Pure White with a more pronounced elevation shadow to separate critical input tasks from the background.

This approach ensures the UI feels lightweight and fast, rather than heavy and "skeuomorphic."

## Shapes

The shape language is **Soft (0.25rem)**. 

While the reference image shows high-radius curves, this system utilizes tighter corners to reflect the professional, "square-jawed" nature of hospital infrastructure. 
- **Buttons and Inputs:** 4px (Soft) radius.
- **Cards and Modals:** 8px (Rounded-LG) radius.
- **Status Pills:** Fully rounded (Pill) to differentiate them from interactive buttons.
- **Icons:** Linear, 2px stroke weight with slight rounding on terminals.

## Components

### Buttons
Primary buttons use the Primary Blue with white text. Secondary buttons use a Slate-100 background with Slate-900 text. Hover states involve a slight darkening of the background color (approx 10%).

### Status Indicators (Chips)
Status chips are critical. They use a "soft-fill" approach: a 10% opacity background of the semantic color (e.g., soft red) with high-contrast bold text of the 100% color. This ensures the status is readable without being visually overwhelming.

### Input Fields
Inputs are rectangular with a Slate-200 border. On focus, the border transitions to Primary Blue with a 2px outer glow. Labels always sit above the field in `body-md` bold.

### Data Tables
Tables are the heart of the system. Header rows use a subtle Slate-100 background. Every second row uses a very faint Slate-50 tint (zebra striping) to assist horizontal eye tracking across maintenance data points.

### Maintenance Cards
For mobile views, list items transform into structured cards. Each card features a "Status Strip" on the left edge—a 4px vertical bar of the semantic status color—allowing for rapid scanning of priority tasks.