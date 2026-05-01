# Design Guidelines: Vehicle Delivery Management System

## Design Approach

**Selected System:** Material Design principles adapted for enterprise logistics
**Rationale:** This is a data-intensive operational system requiring clear information hierarchy, efficient workflows, and reliable interaction patterns. Material Design provides excellent patterns for tables, forms, and status indicators essential for logistics management.

## Core Design Elements

### Brand Colors (OTD Entregas)

**Primary Orange Palette:**
- `--otd-orange-400: #ff5002` - Primary brand color (buttons, links, active states)
- `--otd-orange-300: #fd6927` - Lighter accent
- `--otd-orange-200: #f0800e` - Secondary accent
- `--otd-orange-100: #ff9d4c` - Highlights
- `--otd-orange-50: #ffb97e` - Subtle backgrounds

**Usage:**
- Primary buttons use the main orange (#ff5002)
- Focus rings and active states use primary orange
- Sidebar active items use orange accent
- Charts use orange palette variations
- Status badges use contextual colors (amber/blue/green/red) independent of brand

### Typography
- **Primary Font:** Inter (Google Fonts)
- **Headings:** 
  - H1: 2xl (24px), font-semibold for page titles
  - H2: xl (20px), font-semibold for section headers
  - H3: lg (18px), font-medium for card titles
- **Body:** base (16px), font-normal for content and table data
- **Labels:** sm (14px), font-medium for form labels
- **Metadata:** xs (12px), font-normal for timestamps, secondary info

### Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, and 8
- Component padding: p-4 or p-6
- Section spacing: space-y-6 or space-y-8
- Grid gaps: gap-4 or gap-6
- Card margins: m-4

**Grid Structure:**
- Main container: max-w-7xl mx-auto px-4
- Dashboard cards: 3-column grid (lg:grid-cols-3 md:grid-cols-2 grid-cols-1)
- Forms: 2-column layout (lg:grid-cols-2 gap-6)
- Tables: Full-width responsive with horizontal scroll

### Component Library

**Navigation:**
- Sidebar navigation (w-64) with company logo at top
- Menu items with icons (Heroicons) and labels
- Active state with filled background treatment
- Collapsible on mobile (hamburger menu)

**Tables (Core Component):**
- Bordered table with header row using elevated treatment
- Sortable columns with chevron indicators
- Status badges with rounded-full design
- Row hover states for interactivity
- Sticky header on scroll
- Pagination controls at bottom

**Status Indicators:**
- Badge components (rounded-full px-3 py-1 text-xs font-medium)
- Status types: "Pré-estoque", "Em estoque", "Despachado", "Entregue", "Retirado"
- Pair with dot indicator for quick scanning

**Cards:**
- Elevated cards with rounded-lg borders
- Header section with title and action button
- Body with structured data or forms
- Footer for metadata when needed
- Spacing: p-6 for card padding

**Forms:**
- Label above input pattern
- Input fields: h-10 with rounded-md borders
- Required field indicators with asterisk
- Grouped related fields with section headers
- Clear submit/cancel button hierarchy at bottom-right
- Date pickers for scheduling
- Dropdown selects for relations (motorista, cliente, pátio)

**Action Buttons:**
- Primary: filled style for main actions (Criar Transporte, Salvar)
- Secondary: outlined style for cancel/back
- Icon buttons: for inline actions (edit, delete, view details)
- Floating action button: for quick "New Transport" creation (fixed bottom-right on mobile)

**Notification System:**
- Toast notifications (top-right, slide-in animation)
- Push notification indicator badge on bell icon in header
- Modal for driver acceptance confirmations

**Dashboard Stats Cards:**
- 4-column grid showing key metrics (Total Transportes, Coletas Pendentes, Veículos em Estoque, etc.)
- Large number display with icon and trend indicator
- Click-through to filtered views

**Search and Filters:**
- Global search bar in header
- Filter sidebar for tables (collapsible on mobile)
- Date range picker for temporal filtering
- Multi-select dropdowns for status/location filters

**Detail Views:**
- Split layout: left column for main info, right for timeline/history
- Timeline component showing vehicle journey (Coleta → Pátio → Transporte → Entrega)
- Related data sections in tabs

### Critical Layouts

**Transport List View:**
- Toolbar with search, filters, and "Criar Transporte" button
- Table showing: Status badge, Chassi, N° Solicitação (OTD00001 format), Cliente, Local de Entrega, Data Criação, Motorista, Contato
- Actions column with view/edit/delete icons

**Create Transport Form:**
- Step indicator if multi-step
- Local de Saída dropdown
- Data de Entrega date picker
- Cliente autocomplete select
- Local de Entrega dependent on Cliente
- Chassi search/select from available stock

**Localizar Motorista:**
- Two-panel layout: left for selection criteria, right for available drivers
- Criteria inputs: Pátio, Local de Entrega, Data de Saída
- "Notificar Motoristas" prominent button
- Real-time list of driver responses with accept timestamp
- Driver selection radio buttons with profile summary

**Stock View:**
- Filterable table with Chassi as identifier
- Status pipeline visualization at top
- Quick filters for each status category

### Icons
**Library:** Heroicons via CDN
**Usage:**
- Navigation: truck, map-pin, users, building-office icons
- Actions: plus, pencil, trash, eye icons
- Status: check-circle, clock, truck icons
- Forms: chevron-down for selects

### Responsive Behavior
- Desktop (lg): Full sidebar, multi-column grids, expanded tables
- Tablet (md): Collapsed sidebar with icons, 2-column grids
- Mobile: Hamburger menu, single-column stacked layout, horizontal scroll tables, floating action button for primary actions

### Accessibility
- Form inputs with associated labels (for/id attributes)
- Focus states with ring treatment
- ARIA labels for icon-only buttons
- Keyboard navigation support for all interactive elements
- Screen reader announcements for status changes

**No animations** except subtle transitions on hover states (150ms duration) and toast notifications slide-in.