# Vehicle Delivery Management System

## Overview

This project is a comprehensive Vehicle Delivery Management System designed to streamline logistics operations for new vehicle deliveries. It covers the entire lifecycle, from vehicle collection at manufacturing plants, through storage in company yards, to final delivery to customers. The system aims to enhance efficiency, provide real-time tracking, and improve operational transparency.

Key capabilities include:
- Managing vehicle collections, transport, and inventory with detailed status tracking.
- Comprehensive driver management, including performance metrics, infraction history, and location-based notifications.
- Detailed tracking of vehicles and transports using geospatial data.
- Financial management for routes, freight quotes, and expense settlements.
- Robust reporting and analytics for operational insights (e.g., OTD, OTIF, vehicle journey).
- Secure and scalable architecture to support growing logistics demands.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query
- **UI Components**: Shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS with CSS variables (light/dark mode)
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js (REST API)
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Validation**: Zod (input/output validation)
- **Authentication**: Replit Auth (OpenID Connect/OAuth) with Passport.js
- **Session Management**: express-session with connect-pg-simple

### Data Storage
- **Database**: PostgreSQL with PostGIS 3.5 for spatial data
- **Schema Management**: Drizzle Kit for migrations
- **Core Entities**: drivers, manufacturers, yards, clients, deliveryLocations, vehicles, collects, transports, driverNotifications, checkpoints, routes, contracts, truck_models, freight_quotes, deleted_transports, evaluationCriteria, evaluationScores, broadcasts, broadcast_recipients.

### Key Design Patterns & Features
- **Shared Types**: Centralized schema definitions (`shared/`) for frontend and backend.
- **API Structure**: RESTful endpoints (`/api/`) with authentication.
- **Geospatial Features**: Utilizes PostGIS for storing and querying geographical points (checkin/checkout locations, checkpoints).
- **Workflow Automation**: Status enums drive vehicle, transport, and collection lifecycles.
- **Dynamic Forms & Reporting**: Forms for collections, transports, route management, freight quotes, and detailed reports like "Jornada do Veículo" and "Relatório de Avarias".
- **Real-time Monitoring**: "Tráfego Agora" page provides real-time tracking of active transports and collects on an interactive map.
- **Contract Management**: Rich text editor for driver contracts, email sending functionality, and N:N driver-contract linking.
- **Performance Evaluation**: Driver evaluation criteria with severity-based penalty system.
- **Push Notifications**: Firebase Cloud Messaging (FCM) integration for targeted and broadcast notifications to drivers, including geospatial filtering.
- **Backup & Restore**: System for full or selective database backups, history, and atomic restoration.
- **KPI Dashboard**: "Indicadores" page presenting key performance indicators like OTD, Damage-Free Delivery, OTIF, and Lead Time with historical trends.
- **Vehicle Availability Validation**: Prevents duplicate or invalid transport assignments for vehicles using database-level unique partial indexes and application-level checks.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store.
- **PostGIS**: Spatial extension for geographic data.
- **Drizzle ORM**: TypeScript ORM for database interaction.

### Authentication
- **Replit Auth**: OAuth/OpenID Connect provider.
- **Passport.js**: Authentication middleware for Node.js.

### UI Libraries
- **Radix UI**: Headless UI components.
- **Lucide React**: Icon library.
- **date-fns**: Date manipulation utility.
- **embla-carousel-react**: Carousel component.
- **recharts**: Charting library for data visualization.
- **vaul**: Drawer component.
- **cmdk**: Command palette component.

### Mapping & Geolocation
- **Google Maps API**: For displaying maps, address autocomplete, reverse geocoding, and calculating routes/distances (Google Routes API, Distance Matrix API).

### Messaging
- **Firebase Cloud Messaging (FCM)**: For push notifications to mobile devices.
- **nodemailer**: For sending emails (e.g., contracts to drivers).

### PDF Generation
- **pdfkit**: For generating PDF documents (e.g., expense settlements, vehicle journey reports).
- **jsPDF**: Frontend PDF generation for the redesigned expense settlement (`prestação de contas`) document.

### Digital Signature
- **Autentique** (`server/autentique.ts`): GraphQL integration used to send the expense settlement PDF to the driver's e-mail for digital signature when an operator approves it. The settlement carries `autentiqueDocId`, `autentiqueStatus` (`pendente`/`assinado`/`recusado`), `autentiqueOriginalUrl`, `autentiqueSignedUrl`, `autentiqueSentAt` and `autentiqueSignedAt`. Endpoints: `POST /api/expense-settlements/:id/send-to-autentique` (frontend posts the PDF as base64 right after approve), `POST /:id/resend-autentique`, `POST /:id/sync-autentique`. The settlements list shows "Assinado" with date/time or "Não assinado" with an action button (Enviar / Reenviar) and auto-syncs pending documents on load. Token stored in `app_settings.autentique_api_token`.

### Development Tools
- **Vite**: Frontend build tool.
- **esbuild**: Backend bundling.
- **TypeScript**: Language superset for type safety.