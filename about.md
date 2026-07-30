# Air Freight Tonnage Analysis Dashboard & Subscription Management System
## Executive Project Overview & Management Progress Report

---

## 1. Executive Summary

The **Air Freight Tonnage Analysis Dashboard & Subscription System** is an enterprise-grade Business Intelligence (BI) and reporting platform engineered for **Dart Global Logistics (DGL)**. It unifies freight operations data, financial metrics, and cargo tonnage trends into a single real-time interactive dashboard while providing an automated, scheduled PDF report distribution engine.

### Key Objectives
* **Operational Visibility**: Deliver real-time insights into air freight shipment volumes, chargeable vs. actual weights, revenue, costs, and gross profit margins across global stations (e.g., India, Sri Lanka, Vietnam, Bangladesh, Pakistan, USA).
* **Automated Stakeholder Reporting**: Automate weekly, daily, and monthly PDF report generation and email delivery to executive management, regional directors, and station managers via Microsoft Graph API.
* **Ad-Hoc Business Intelligence**: Provide BI power users with a Custom SQL Query Studio capable of querying live data and caching SQL states for lightweight report exports.
* **Serverless Cost Efficiency**: Fully containerized and deployed on Google Cloud Run with scale-to-zero capability, synchronized with Google Cloud Scheduler and Supabase Postgres.

---

## 2. System Architecture & Component Interaction

```mermaid
graph TD
    User([User / Browser]) <--> FE[Next.js 14 Frontend - React / Tailwind / Recharts]
    FE <--> BE[FastAPI Python Backend - Uvicorn]
    
    subgraph Data Sources & Processing
        BE <--> Gate[On-Prem API Proxy: survey.dartglobal.com]
        Gate <--> MSSQL[(Microsoft SQL Server: DartBIDW)]
        BE <---- Direct Fallback ----> MSSQL
    end
    
    subgraph PDF Generation & Distribution Engine
        BE --> Playwright[Playwright Headless Chromium]
        Playwright --> PV[Frontend /print-view Route]
        PV --> PDF[Landscape A4 PDF Output]
        BE --> MSGraph[Microsoft Graph API - Azure AD OAuth2]
        MSGraph --> Email[Email Dispatched to Stakeholders]
    end
    
    subgraph Scheduling & Authentication Infrastructure
        FE <--> Supabase[(Supabase Postgres - Auth & Schedules DB)]
        BE <--> Supabase
        BE <--> CloudScheduler[Google Cloud Scheduler]
    end
```

---

## 3. Core Feature Set & Capabilities

### 📊 Real-Time Interactive BI Dashboard
* **Executive KPI Cards**: Real-time aggregation of key performance indicators:
  * Total Shipments
  * Chargeable Tonnage (kg)
  * Actual Tonnage (kg)
  * Revenue (USD)
  * Direct Cost (USD)
  * Profit (USD)
  * Gross Profit Margin (%)
* **Multi-Dimensional Analytical Charts**: Dynamic weekly and monthly trend visualizations powered by Recharts.
* **Sector & Carrier Distribution**: Carrier market share breakdowns by load port and discharge port.
* **Interactive Data Ledgers**: Paginated, searchable, and exportable data tables with custom column filters.

### 🔍 Advanced Dynamic Filtering
* **Date Range Filtering**: Filter by Estimated Time of Departure (ETD).
* **Geographical & Entity Filters**:
  * Origin Country & Origin City
  * Destination Country & Destination City
  * Forwarder Company Code (e.g., CMB, IND, VNM, DAC, PKI, NYC)
  * Airline Carrier
  * Operating Branch

### 🛠️ Custom SQL Query Studio
* Enables BI analysts to execute raw SQL queries against `DartBIDW`.
* Automatic regex parser extracts station details (`Company`, `ConLoadPortCountryName`) and ETD date bounds.
* Server-side query caching (`query_cache`) for fast UI rendering and print view hydration.

### 📅 Automated Subscription & Report Dispatch Engine
* **Flexible Scheduling**: Daily, Weekly (on specified day), or Monthly (on specified date) execution.
* **Customizable Report Sections**: Toggles for visual charts, ledgers, sector breakdowns, and max data row limits to maintain lightweight PDF attachments.
* **Cloud-Native Resilience**: Integrates with Google Cloud Scheduler so scheduled tasks wake up Cloud Run instances from scale-to-zero states.
* **Enterprise Audit Logging**: Persistent log trails recorded in `logs/email_history.log` and `logs/service.log`.

### 🔒 Enterprise Security & RBAC
* **Authentication**: Supabase JWT verification integrated with FastAPI dependencies.
* **Role-Based Authorization**: Database check against `allowed_admins` whitelist table.
* **Secure Webhook Verification**: `X-Scheduler-Token` header validation for Cloud Scheduler execution calls.

---

## 4. Technology Stack & Technical Specifications

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | Next.js 14 (React 18, TypeScript) | Responsive SPA & Print-View Rendering |
| **Styling & Components** | Tailwind CSS, Lucide Icons, Framer Motion | Modern UI & Micro-animations |
| **Data Visualization** | Recharts | Responsive line, bar, and pie charts |
| **Backend Framework** | FastAPI (Python 3.10+) | High-performance asynchronous REST API |
| **Data Processing** | Pandas, SQLAlchemy, PyODBC | ETL, SQL query formatting, data cleaning |
| **Database Gateway** | Microsoft SQL Server (`DartBIDW`), On-Prem REST API | Operational data warehouse source |
| **Persistence & Auth** | Supabase Postgres | User schedule storage & Admin RBAC |
| **PDF Generation** | Playwright (Headless Chromium) | DOM snapshot to landscape A4 PDF |
| **Email Dispatch** | MSAL Python, Microsoft Graph API | Azure AD OAuth2 corporate email delivery |
| **Task Scheduling** | Google Cloud Scheduler | Serverless cron execution engine |
| **Containerization** | Multi-Stage Dockerfile (Node 20 + Python Playwright) | Production build & deployment |
| **Hosting Platform** | Google Cloud Run / Render | Serverless container hosting |

---

## 5. Key Database Views & Queries

The system aggregates data from three core views in `DartBIDW`:
1. `dbo.ChatData_ViewShipConsolTransport`: Master airway bill, console numbers, transport mode (AIR), load port country/city, discharge port country/city, and ETD.
2. `dbo.ChatData_ViewShipConsolLink`: Links transport console numbers (`Link_ConsolNumber`) with individual shipment numbers (`Link_ShipmentNum`).
3. `dbo.ChatData_ViewRevandVolume_ShipmentDate`: Shipment-level revenue, direct cost, profit, chargeable weight, actual weight, and sending forwarder company code.

---

## 6. Management Progress Report: Completed Milestones & Status

| Phase | Milestone / Task | Status | Completion Details |
| :---: | :--- | :---: | :--- |
| **1** | **Database & Data Pipeline Architecture** | ✅ **Completed** | Configured dual-mode database layer (On-Prem HTTP API proxy with fallback to direct ODBC connection to `DartBIDW`). Implemented pandas-based data cleaning for NaN/Inf values. |
| **2** | **Interactive BI Frontend Development** | ✅ **Completed** | Developed responsive Next.js dashboard featuring executive KPI cards, weekly/monthly Recharts, sector carrier distribution, and paginated data ledgers with dynamic filter controls. |
| **3** | **Custom SQL Query Engine & Query Caching** | ✅ **Completed** | Built custom SQL execution studio with regex-based station/date extraction and server-side query caching for fast PDF rendering. |
| **4** | **Automated Headless PDF Generation** | ✅ **Completed** | Built `api/pdf_service.py` using Playwright Chromium to render `/print-view` route with `#pdf-ready` signal detection, outputting landscape A4 PDFs. |
| **5** | **Microsoft Graph & Azure AD Email System** | ✅ **Completed** | Integrated MSAL token acquisition and MS Graph API (`sendMail`) for sending emails with base64 PDF attachments from `bi.support@dartglobal.com`. Added audit logging. |
| **6** | **Cloud Scheduler & Subscription Database** | ✅ **Completed** | Implemented `report_schedules` storage on Supabase Postgres and built `sync_schedule_to_cloud()` mapping user frequencies to 5-field UTC cron triggers. |
| **7** | **Security & Access Control (RBAC)** | ✅ **Completed** | Implemented Supabase JWT token validation and `allowed_admins` whitelist table check for admin endpoint protection. |
| **8** | **Containerization & Cloud Deployment** | ✅ **Completed** | Designed multi-stage Dockerfile combining Node.js static export with Python Playwright backend, ODBC Driver 17 installation, and Cloud Run $PORT binding. |

---

## 7. Operational Directory & File Structure

```
Tonnage_Analysis_Dashboard_and_Subscriptions/
├── api/
│   ├── main.py                   # Primary FastAPI application & REST routing
│   ├── database.py               # SQL queries, data aggregation & gateway fallback
│   ├── pdf_service.py            # Playwright headless PDF generation engine
│   ├── email_service.py          # MS Graph API & Azure AD email sender
│   ├── cloud_scheduler_service.py# Google Cloud Scheduler integration
│   └── scheduler_db.py           # Supabase REST client for subscription persistence
├── frontend/
│   ├── app/
│   │   ├── page.tsx              # Main BI Dashboard single-page application
│   │   ├── layout.tsx            # Global UI layout & font configuration
│   │   └── print-view/page.tsx   # Print-optimized view for PDF capture
│   └── components/               # UI components (Radix/Tailwind)
├── utilities/
│   └── sql_query_doc.py          # SQL documentation helpers
├── logs/                         # Execution & email transaction logs
├── outputs/                      # Generated PDF storage directory
├── weekly_report_mailer.py       # Standalone/CLI weekly mailer script
├── Dockerfile                    # Multi-stage production container manifest
├── render.yaml                   # Alternative PaaS deployment spec
├── requirements.txt              # Python dependencies
└── about.md                      # Comprehensive Project Overview & Progress Report
```

---

## 8. Strategic Roadmap & Next Steps

1. **Excel & CSV Report Attachments**: Expand subscription options to allow attaching raw Excel/CSV data ledgers alongside PDF reports.
2. **Automated Anomaly Detection**: Implement alert triggers when weekly tonnage or GP margins drop below predefined thresholds.
3. **Multi-Currency Conversion Engine**: Add dynamic currency conversion for global stations operating in non-USD local currencies.
4. **Custom Email Template Designer**: Provide rich text editor in dashboard for users to customize email body text per station.

---
*Report Compiled for Management Review | Dart Global Logistics BI Team*
