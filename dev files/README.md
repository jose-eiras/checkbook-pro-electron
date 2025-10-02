# CheckBook Pro - Financial Management System

## Overview
CheckBook Pro is a comprehensive web-based financial management application originally built as an Electron desktop app and successfully adapted for Replit's web environment. The application provides professional-grade financial tracking, account management, and transaction processing capabilities.

## Current State
✅ **Fully Operational** - The application has been successfully imported and configured to work in Replit's environment.

## Project Architecture

### Technology Stack
- **Frontend**: HTML5 single-page application with vanilla JavaScript
- **Backend**: Node.js with Express server proxying PHP API calls
- **API Layer**: PHP REST API for database operations
- **Database**: SQLite with pre-existing financial data
- **Server**: Express.js serving on port 5000

### Key Components
1. **server.js** - Main Express server that serves the frontend and proxies API requests
2. **checkbook-pro.html** - Complete single-page application frontend
3. **api.php** - Simplified PHP API for database operations
4. **checkbook-pro.sqlite3** - SQLite database with existing financial data
5. **checkbook-pro-api.php** - Original comprehensive PHP API (backup)

### Database Schema
The application includes the following main tables:
- **users** - User authentication and checkbook associations
- **checkbooks** - Financial account groups/businesses
- **accounts** - Individual financial accounts (assets, liabilities, income, expenses)
- **transactions** - Financial transaction records
- **reconciliations** - Bank reconciliation tracking

## Features
- 🔐 User authentication with checkbook-based access control
- 📊 Dashboard with financial summaries and key metrics
- 🏦 Asset & liability account management
- ↔️ Transaction recording and management
- 📈 Financial reporting and reconciliation
- 👤 User management (admin features)
- 🎯 Professional banking-themed UI

## Recent Changes
- **2025-09-04**: **CSV IMPORT/EXPORT FULLY OPERATIONAL** - All issues resolved
- **2025-09-04**: **CRITICAL FIX** - Added Transaction Type column to CSV export/import for accurate balance calculations
- **2025-09-04**: Fixed CSV parsing to properly handle quoted fields with commas (e.g., "Feb 4, 2025")
- **2025-09-04**: Fixed API request serialization for proper frontend-backend communication
- **2025-09-04**: Verified transaction creation with automatic account balance updates (credit/debit)
- **2025-09-04**: Cleaned up debug logging for production deployment
- **2025-09-04**: Added comprehensive server-side validation and logging
- **2025-09-04**: Installed missing Electron dependencies (mesa, libgbm) for proper GUI support
- **2025-09-03**: Successfully imported from GitHub and adapted for Replit
- **2025-09-03**: Created Express.js server to serve frontend on port 5000
- **2025-09-03**: Updated all API endpoints to use local `/api/` routes
- **2025-09-03**: Configured autoscale deployment for production
- **2025-09-03**: Verified full functionality with existing database data

## Configuration
- **Development**: `npm start` - Runs on http://0.0.0.0:5000
- **Production**: Configured for Replit autoscale deployment
- **API Base**: `/api/` (proxied to PHP backend)
- **Database**: SQLite file located at `./checkbook-pro.sqlite3`

## Available Checkbooks
The database currently contains:
1. "Personal Finance" (ID: 9000dfce-2000-4261-ac2d-028bdb754064)
2. "Test Checkbook Changed" (ID: checkbook_68b7101c97b9c6.75259915)

## User Preferences
- Clean, professional financial interface maintained
- Banking-themed color scheme preserved
- Responsive design for various screen sizes
- All original functionality preserved during web adaptation

## API Endpoints
- `GET /api/checkbooks` - List available checkbooks
- `POST /api/auth/login` - User authentication
- `GET /api/accounts?checkbook_id=X` - Get accounts for checkbook
- `GET /api/transactions?checkbook_id=X` - Get transactions
- Various other endpoints for CRUD operations

## Next Steps
The application is ready for use. Users can:
1. Select a checkbook from the login dropdown
2. Enter credentials to access their financial data
3. Navigate through all features: dashboard, accounts, transactions, reports
4. Perform full financial management operations

The project maintains all original functionality while being fully adapted for web deployment on Replit.