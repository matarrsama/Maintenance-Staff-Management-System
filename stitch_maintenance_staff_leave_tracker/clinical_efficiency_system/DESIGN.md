---
name: Clinical Efficiency System
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#444651'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#757682'
  outline-variant: '#c5c5d3'
  surface-tint: '#4059aa'
  primary: '#00236f'
  on-primary: '#ffffff'
  primary-container: '#1e3a8a'
  on-primary-container: '#90a8ff'
  inverse-primary: '#b6c4ff'
  secondary: '#006a61'
  on-secondary: '#ffffff'
  secondary-container: '#86f2e4'
  on-secondary-container: '#006f66'
  tertiary: '#272b2d'
  on-tertiary: '#ffffff'
  tertiary-container: '#3d4143'
  on-tertiary-container: '#aaadaf'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#b6c4ff'
  on-primary-fixed: '#00164e'
  on-primary-fixed-variant: '#264191'
  secondary-fixed: '#89f5e7'
  secondary-fixed-dim: '#6bd8cb'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#005049'
  tertiary-fixed: '#e0e3e5'
  tertiary-fixed-dim: '#c4c7c9'
  on-tertiary-fixed: '#191c1e'
  on-tertiary-fixed-variant: '#444749'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
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
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 24px
  gutter: 16px
  section-gap: 32px
  data-density-compact: 8px
  data-density-comfortable: 16px
---

## Brand & Style
The design system is engineered for the high-stakes environment of Hospital Maintenance, where clarity and reliability are paramount. The brand personality is **authoritative, systematic, and calm**, aiming to reduce the cognitive load on administrators and staff managing complex rosters.

The design style follows a **Modern Corporate** aesthetic with a lean toward **Minimalism**. It prioritizes a high information-density layout that remains readable through generous functional white space and a strict typographic hierarchy. Visual elements are restrained to ensure that critical data—such as staffing gaps and urgent leave requests—remains the primary focus.

## Colors
This design system utilizes a palette rooted in "Hospital Blue" to evoke trust and stability.

- **Primary (#1E3A8A):** Used for navigation, primary actions, and branding elements. It signifies authority and the core structure of the institution.
- **Secondary (#0D9488):** A calming teal used for secondary actions, accents, and "system-healthy" indicators.
- **Surface & Background:** The system defaults to a light mode using a range of cool grays (Slate 50 to Slate 900) to create clear separation between data containers without the harshness of pure black on white.
- **Semantic Colors:** 
  - **Red (#BE123C):** Reserved strictly for critical alerts, rejected leave, and staffing shortages.
  - **Green (#15803D):** Used for approved requests and successful system feedback.

## Typography
The system uses **Inter** exclusively to leverage its exceptional legibility in data-heavy interfaces. 

- **Numeric Data:** For roster views and tables, use tabular figures (`tnum`) to ensure numbers align vertically, facilitating quick scanning of dates and hours.
- **Hierarchy:** Use `headline-md` for section titles within the dashboard and `label-md` for table headers and form labels to provide a clear structural anchor.
- **Readability:** Maintain a minimum of 14px for body text in forms to ensure high compliance and low error rates during data entry.

## Layout & Spacing
The layout employs a **12-column fluid grid** for desktop, transitioning to a single-column layout for mobile. 

- **Grid Strategy:** Use a fixed-width sidebar (280px) for navigation, with a fluid main content area.
- **Roster Views:** Utilize a horizontal-scroll-friendly layout for the "Master Roster," ensuring the name column remains sticky.
- **Mobile Adaption:** On mobile, complex tables must reflow into "Card Groups" where each row becomes a standalone card to maintain legibility.
- **Margins:** Use a standard 24px margin for desktop containers to provide visual "breathing room" in high-density views.

## Elevation & Depth
To maintain a clinical and professional feel, depth is achieved through **Tonal Layering** and **Low-contrast Outlines** rather than heavy shadows.

- **Level 0 (Background):** Slate 50 (#F8FAFC).
- **Level 1 (Cards/Tables):** Pure White (#FFFFFF) with a 1px border in Slate 200 (#E2E8F0).
- **Level 2 (Modals/Popovers):** Pure White with a subtle, highly-diffused shadow (0px 4px 20px rgba(30, 58, 138, 0.08)) to indicate temporary interaction layers.
- **Interactive States:** Buttons and input fields should utilize a subtle 1px inset shadow on "active/pressed" states to provide tactile feedback without breaking the flat aesthetic.

## Shapes
The shape language is **Soft (0.25rem)**. This provides a balance between the precision of sharp corners and the approachability of rounded ones.

- **Components:** Buttons, Input Fields, and Chips use the base `rounded` (4px) setting.
- **Containers:** Large dashboard cards and modals use `rounded-lg` (8px) to soften the overall interface.
- **Status Badges:** Use a higher roundedness (`rounded-xl` or pill) to distinguish them from interactive buttons.

## Components
- **Structured Tables:** Headers must be sticky with a distinct Slate 100 background. Rows should feature a subtle hover state (#F1F5F9) to assist tracking across wide data sets.
- **Intuitive Calendars:** The roster view uses a "cell-based" grid. Approved leave is a solid Teal block; pending leave is a Teal outline with a diagonal stripe pattern.
- **Status Badges:**
  - *Pending:* Neutral background (Slate 100) with Slate 700 text.
  - *Approved:* Secondary light background (Teal 50) with Teal 800 text.
  - *Denied:* Red 50 background with Red 800 text.
- **Input Fields:** Use a standard height of 40px with 12px horizontal padding. Borders should darken from Slate 200 to Primary Blue on focus.
- **Buttons:** 
  - *Primary:* Solid #1E3A8A with white text.
  - *Secondary:* Outline of #1E3A8A with #1E3A8A text.
  - *Ghost:* No border, Slate 600 text, for low-priority actions like "Cancel."
- **Data Cards:** Small summary cards at the top of the dashboard should display key metrics (e.g., "Staff on Leave Today") using `headline-lg` for the value and `label-md` for the description.