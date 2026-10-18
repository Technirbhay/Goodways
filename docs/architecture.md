# Architecture - GoodWays AI Infrastructure Intelligence Platform

GoodWays AI is an advanced roadway damage inspection, measurement, and government grievance dispatch platform.

## System Architecture

```text
  +-------------------------------------------------------------+
  +                     Frontend SPA (React 18)                 +
  +  - Citizen Report View (Camera / GPS / Image Canvas)        +
  +  - Official Triage Dashboard & City GIS Map                 +
  +  - Auth Modal (Citizen / Authority with Admin Passkey)      +
  +-------------------------------------------------------------+
                                 │
                                 │ HTTPS / REST API
                                 ▼
  +-------------------------------------------------------------+
  +                     Backend API (Node.js & Express)         +
  +  - RBAC Authentication & Approval Middleware                +
  +  - Gemini 3.8 Flash Vision Model Integration                +
  +  - Free Government Portal Dispatch (NHAI / CPGRAMS / PWD)   +
  +  - JSON Data Persistence (cases.json, users.json)           +
  +-------------------------------------------------------------+
```

## Key Modules
1. **Frontend (`/frontend`)**: Built with React, Vite, Tailwind CSS, and Leaflet GIS mapping.
2. **Backend (`/backend`)**: Built with Express and TypeScript (`tsx`), handling Gemini 3.8 Flash API calls, EXIF metadata extraction, reverse geocoding, and RBAC security.
3. **Data Storage**: JSON-based persistent local storage in `/data` supporting offline synchronization and audit trails.
