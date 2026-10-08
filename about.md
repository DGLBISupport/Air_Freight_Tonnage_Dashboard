# Air & Sea Freight Analysis Dashboard & Subscription Management System

## Air and Sea workspaces

The **Air Freight** and **Sea Freight** tabs share the complete dashboard, weekly/monthly SQL reports, station and branch reporting, PDF preview/export, report email delivery, and subscription features. Each workspace retains its own dates, filters, SQL editors, results, and schedules when switching tabs. User authentication and recipient directories are shared.

Every data, print, email, and schedule request carries `transport_mode` (`AIR` or `SEA`). Requests and existing subscriptions without that field default to `AIR`. The mode is stored in the existing schedules `filters` JSON, so no Supabase schema migration is required.

Each Air/Sea Weekly and Monthly SQL report has its own recipient picker beside the SQL controls. Search saved or organization users by name, select a matching person, or enter an email address and select it. The selection replaces that report's default address and persists when switching reports. Execute the current query, choose **Preview & Send Report**, review the PDF sections and recipient, and confirm sending. Editing SQL requires another successful execution before sending. Custom addresses are used for that report without automatically adding or changing Supabase users or subscriptions.

Sea queries use `vt.ShippinLine`, `vt.ShippingLineGroup`, `vt.FCLTEU`, `vt.LCLVolume`, the consol/shipment link views, and `vs.Company`. Country, company, branch, carrier, route, and date filters are dynamic. Sea dates use `vt.ETD >= :start_date` and `vt.ETD <= :end_date`, matching the requested SQL format. For datetime ETDs, an end date without a time compares against midnight. Consol-level TEUs and LCL volume use `MAX` before consol rollups to avoid multiplication by linked shipment rows; linked shipment revenue is summed only to supply the consol revenue field. Sea reports contain no shipment counts, cost, profit or margin metrics. Sea uses its own **consol-based report** with Revenue, FCL **TEUs**, LCL **m³**, and **No. of Consols**, daily quantity charts, shipping-line and route summaries, and a one-row-per-consol ledger. The native quantity aliases are `FCL_TEU_Count` and `LCL_Volume`; pasted copies of the supplied joined SQL also use `MAX` for these consol quantities. Legacy quantity aliases remain accepted. Air retains its shipment-based analysis. Sea summaries are derived from a single consol data response, avoiding unnecessary financial/sector queries in dashboards and previews. No sea quantity is converted to kilograms or tons. Sea uses the Air dashboard’s card sizes, typography, colors, section headings and chart grid. Standard mode shows weekly revenue flow with a shipping-line share doughnut; SQL reports show daily shipping-line TEU stacks. Sea PDFs use the same DGL logo header, KPI cards and blue table headers while keeping continuous page flow and consol-only metrics.

The standalone mailer accepts `python weekly_report_mailer.py --transport-mode SEA`; the default remains `AIR`. This command sends reports to configured recipients, just like the existing air mailer.

Validation: `node tests/sea_consols.cjs`, `node tests/freight_query_templates.cjs`, `python -m unittest discover -s tests -v`, `npx tsc --noEmit --incremental false` from `frontend`, and `npm run build`. The optional offline browser smoke test (`python tests/browser_freight_modes.py`) expects `frontend/out` served on `http://127.0.0.1:4173` and an installed Chrome browser. It intercepts external/API requests with fixtures and performs no real email, authentication, or subscription writes.

Report previews and email PDFs share identical database reads for up to **60 seconds**. Concurrent requests for the same SQL and parameters execute once; AIR/SEA queries and distinct filters have separate cache entries. The process-local cache holds at most 32 entries / 64 MiB and does not retain failed queries. A failed database gateway is bypassed for 60 seconds when direct SQL Server credentials are configured.

Sea's first load also avoids redundant revenue aggregation. The shipment revenue view groups facts across many descriptive fields before the report sums them again by consol; Air reads consol financial totals directly. For compatible Sea queries, the backend reads the current view definition and removes only that intermediate grouping, preserving every original join, financial sum, distinct shipment count, and consol quantity. The live India/IND report for 28 September–4 October 2026 returned the same 149 rows and values in about 6 seconds, compared with roughly 37 seconds previously; timings depend on the database and date range. Dropdowns without a company filter omit the shipment joins entirely. Unrecognized view definitions, queries requiring the original grouped amounts, and accounts lacking underlying-table permissions fall back to the original view query. No database objects or indexes are changed.

Air sector data loads alongside the main report and is skipped when excluded. Sea destination summaries use the already loaded consol records. Local previews use the local API even when the frontend was built with a cloud API URL. Headless email rendering explicitly uses this backend (`API_PORT`, default 8000 locally; `PORT`, default 8080 in Cloud Run) and receives SQL directly rather than relying on another worker's query cache. `FRONTEND_BASE_URL` selects the frontend.

Air and Sea report previews and PDFs use a continuous layout: sections grow with their contents instead of reserving fixed-height pages or forcing a new page after every section. A4 landscape printing keeps small page margins, repeats table headers, and allows the Sea volume table to split across pages while keeping charts and individual table rows intact. `python tests/browser_report_layout.py` checks this with fixture data against the static frontend served on port 4173.

Sea ETD calendar grouping uses the station's local date consistently in the dashboard, PDF, and LCL panel. SQL timestamps without a timezone retain their stored calendar date; explicitly offset timestamps convert to the configured station timezone (India uses `Asia/Kolkata`). UTC is used only for calendar arithmetic after selecting that date, so the browser's timezone cannot move October 1 into September 30. `node tests/operational_dates.cjs` checks the real chart functions in four timezones; `python tests/browser_operational_dates.py` checks rendered axes with fixture APIs.

The print view has a 45-second data-load deadline and signals PDF readiness after fonts and chart layout render. PDF generation refuses to capture loading screens, missing pages, or report errors, and closes the browser on failure. Manual sends show the API error instead of reporting success. Both standalone AIR and SEA mailers use the same PDF checks.

---

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
