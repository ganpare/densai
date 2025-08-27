# Overview

This is an Electronic Bond Network Inquiry Response Reporting System (電子債権問い合わせ対応報告書システム) built as a full-stack web application. The system manages inquiry responses for electronic bond networks, providing a streamlined workflow from report creation to approval and printing. It features a role-based access control system with creators, approvers, and admins, allowing for efficient processing of daily reports with structured approval workflows.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: Radix UI components with Tailwind CSS for styling, following the shadcn/ui design system
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Routing**: Wouter for client-side routing
- **Form Handling**: React Hook Form with Zod schema validation
- **Component Structure**: Modular component architecture with reusable UI components in `/components/ui/`

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API structure with route handlers in `/server/routes.ts`
- **Middleware**: Custom logging middleware for API requests and error handling
- **Development**: Hot reload with Vite integration for full-stack development

## Authentication & Authorization
- **Provider**: Replit OAuth integration using OpenID Connect
- **Session Management**: Express sessions with PostgreSQL session store
- **Role-Based Access**: Three user roles (creator, approver, admin) with approval level hierarchies
- **Security**: HTTP-only cookies with secure session handling

## Database Architecture
- **Database**: PostgreSQL with connection pooling via Neon serverless
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Management**: Centralized schema definitions in `/shared/schema.ts` with Zod validation
- **Key Entities**:
  - Users with role-based permissions
  - Financial institutions and branch master data
  - Reports with status tracking and approval workflows
  - Session storage for authentication

## Data Flow & Business Logic
- **Report Lifecycle**: Draft → Pending → Approved/Rejected workflow
- **Approval System**: Multi-level approval based on user roles and approval levels
- **Real-time Updates**: Statistics dashboard with live data refresh
- **Print Integration**: PDF generation and secure printing to financial institution printers

## Shared Resources
- **Type Safety**: Shared TypeScript types between client and server via `/shared/` directory
- **Validation**: Consistent data validation using Zod schemas across frontend and backend
- **Path Aliases**: TypeScript path mapping for clean imports (`@/`, `@shared/`)

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Database URL**: Required environment variable for database connectivity

## Authentication Services  
- **Replit OAuth**: OpenID Connect integration for user authentication
- **Session Storage**: PostgreSQL-backed session storage using connect-pg-simple

## Development Tools
- **Vite**: Build tool and development server with React plugin
- **Replit Integration**: Development environment with cartographer plugin and runtime error overlay
- **TypeScript**: Static type checking across the entire application stack

## UI Framework Dependencies
- **Radix UI**: Accessible component primitives for complex UI interactions
- **Tailwind CSS**: Utility-first CSS framework with custom design system
- **Lucide React**: Icon library for consistent iconography
- **Date-fns**: Date manipulation and formatting utilities

## Validation & Forms
- **Zod**: Schema validation library used across client and server
- **React Hook Form**: Form state management with @hookform/resolvers for Zod integration
- **Class Variance Authority**: Type-safe component variant handling