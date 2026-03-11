# MaqManager PRD - Professional UI Transformation

## Original Problem Statement
Transform MaqManager (machine repair management Electron desktop app) to a more professional and modern UI while keeping the same MySQL database and naming conventions.

## User Choices
1. **Theme**: Dark/Light mode toggle
2. **Alarm System**: Improved with priority levels and visual indicators
3. **Navigation**: Sidebar + main dashboard (replacing top navbar)
4. **Platform**: Desktop only (Electron)

## Architecture
- **Frontend**: React.js with Tailwind CSS
- **Backend**: Node.js/Express (unchanged)
- **Database**: MySQL (unchanged - connects to local IPs 192.168.1.x)
- **Desktop**: Electron framework

## Core Requirements (Static)
- Maintain all existing API endpoints and database schema
- Portuguese language throughout
- Professional industrial aesthetic for machine repair business

## What's Been Implemented (2026-03-11)

### New Components Created
- `/frontend/src/components/Sidebar.js` - Collapsible sidebar navigation with alarm badge (no Configurações)
- `/frontend/src/components/Layout.js` - Main layout wrapper with sidebar
- `/frontend/src/components/Dashboard.js` - Main dashboard with stats, recent repairs, alarms
- `/frontend/src/components/theme-provider.js` - Dark/Light theme context
- `/frontend/src/lib/utils.js` - Utility functions (cn helper)

### Updated Components (ALL PAGES REDESIGNED)
- `/frontend/src/App.js` - New routing with Layout wrapper
- `/frontend/src/index.js` - Simplified entry point
- `/frontend/src/index.css` - Complete Tailwind CSS setup with dark/light themes
- `/frontend/src/Reparacoes/Reparacoes.js` - Modernized with stat cards, filters, DataTable styling
- `/frontend/src/Reparacoes/ReparacoesRegisto.js` - **NEW** Modern form with equipment, parts, client, workflow, financial sections
- `/frontend/src/Reparacoes/ReparacoesEdit.js` - **NEW** Edit form matching new design system
- `/frontend/src/Reparacoes/ReparacoesView.js` - **NEW** Detail view with PDF modal, financial summary
- `/frontend/src/components/ClientesList.js` - Grid layout with cards, search, modals
- `/frontend/src/components/ClienteForm.js` - Professional form with icons
- `/frontend/src/components/AlarmesSistema.js` - Enhanced with priority filters, card grid, detail modal

### Configuration
- `/frontend/tailwind.config.js` - Custom theme with CSS variables
- New dependencies: lucide-react, sonner, tailwind-merge, clsx, class-variance-authority

### Design System
- Typography: Barlow Condensed (headings), Manrope (body), JetBrains Mono (code)
- Color palette: Blue primary, semantic colors for status (success, warning, destructive, orange)
- Dark mode default with light mode toggle
- Noise texture overlay in dark mode

## User Personas
- Machine repair shop employees
- Shop managers tracking repairs and budgets
- Administrative staff managing client records

## Prioritized Backlog

### P0 (ALL COMPLETED)
- [x] Sidebar navigation (without Configurações)
- [x] Dashboard with stats
- [x] Dark/Light theme toggle
- [x] Improved alarm system UI
- [x] Modernized Reparações list
- [x] Modernized ReparacoesRegisto (new repair form)
- [x] Modernized ReparacoesEdit (edit form)
- [x] Modernized ReparacoesView (detail view)
- [x] Modernized Clientes list

### P1 (Future Enhancements)
- [ ] PDF export styling improvements
- [ ] Charts and analytics on dashboard
- [ ] Client repair history view

## Next Tasks
1. Add charts/analytics to dashboard (monthly repair evolution, average completion time)
2. Improve PDF export with branded template

## Notes
- Backend connects to MySQL at local IPs (192.168.1.81, 192.168.1.2)
- For preview/demo environment, frontend renders but API calls fail (expected)
- Full functionality requires running on local network with MySQL server
