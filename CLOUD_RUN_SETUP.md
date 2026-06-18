# Cloud Run Deployment Checklist - Fix 503 Error

## Problem
The `/api/send-report` endpoint returns 503 (Service Unavailable) on Cloud Run but works locally.

## Root Causes & Fixes

### ✅ 1. Dockerfile Updates (ALREADY DONE)
- ✓ Added ODBC driver installation for SQL Server
- ✓ Added startup command using `uvicorn` to start FastAPI

### ✅ 2. Required Environment Variables - SET THESE IN CLOUD RUN

**For Email Sending (Microsoft Graph API):**
```
MAIL_AZURE_TENANT_ID=<your-azure-tenant-id>
MAIL_AZURE_CLIENT_ID=<your-azure-app-client-id>
MAIL_AZURE_CLIENT_SECRET=<your-app-client-secret>
SENDER_EMAIL=<your-sender-email@company.com>
```

**For Database Connection (SQL Server):**
```
DB_SERVER=<your-sql-server-name.database.windows.net or on-prem server>
DB_USER=<sql-username>
DB_PASSWORD=<sql-password>
ONPREM_API_URL=<optional-api-endpoint>  # Has default: https://survey.dartglobal.com/chatbot/v1.0/data
```

**For Email Recipients:**
```
RECIPIENT_EMAILS=<comma-separated-email-list>
# OR station-specific:
RECIPIENTS_CMB=shashini.hq@dartglobal.com
RECIPIENTS_IND=other-email@dartglobal.com
```

### 🔧 3. How to Set Environment Variables in Cloud Run

#### **Option A: Using Cloud Console (Easiest)**
1. Go to [Cloud Run Console](https://console.cloud.google.com/run)
2. Click on your service
3. Click **Edit & Deploy New Revision**
4. Scroll down to **Runtime Settings**
5. Under **Runtime Environment Variables**, add each variable:
   - Click **Add Variable**
   - Enter Name and Value for each required variable
6. Click **Deploy**

#### **Option B: Using gcloud CLI**
```bash
gcloud run deploy tonnage-report \
  --set-env-vars=MAIL_AZURE_TENANT_ID=xxx \
  --set-env-vars=MAIL_AZURE_CLIENT_ID=xxx \
  --set-env-vars=MAIL_AZURE_CLIENT_SECRET=xxx \
  --set-env-vars=SENDER_EMAIL=xxx \
  --set-env-vars=DB_SERVER=xxx \
  --set-env-vars=DB_USER=xxx \
  --set-env-vars=DB_PASSWORD=xxx \
  --region us-central1
```

#### **Option C: Using Cloud Run YAML**
Create `deploy.yaml`:
```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: tonnage-report
spec:
  template:
    spec:
      containers:
      - image: gcr.io/PROJECT_ID/tonnage-report:latest
        env:
        - name: MAIL_AZURE_TENANT_ID
          value: "xxx"
        - name: MAIL_AZURE_CLIENT_ID
          value: "xxx"
        # ... add all other variables
```

### 🔐 4. Security Best Practices

**IMPORTANT: Use Cloud Secret Manager instead of plain text**

```bash
# Create secrets
gcloud secrets create MAIL_AZURE_CLIENT_SECRET --data-file=- <<< "your-secret"

# Grant Cloud Run access
gcloud secrets add-iam-policy-binding MAIL_AZURE_CLIENT_SECRET \
  --member=serviceAccount:PROJECT_ID@appspot.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor

# Reference in deployment
gcloud run deploy tonnage-report \
  --set-env-vars=MAIL_AZURE_CLIENT_SECRET=secret:MAIL_AZURE_CLIENT_SECRET:latest \
  ...
```

### 🧪 5. Debugging - Check Cloud Run Logs

```bash
# View real-time logs to see the actual 503 error
gcloud run services describe tonnage-report --region us-central1
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=tonnage-report" \
  --limit 50 --format=json | jq .

# Or in Cloud Console: Go to Cloud Run → Logs
```

### ✅ 6. Verify Database Connectivity

If you see database connection errors:
- **For Azure SQL Database**: Ensure Cloud Run IP is whitelisted in Azure SQL firewall
- **For On-Premises**: Ensure Cloud Run can reach your on-prem network (VPN/private connectivity)

Add these credentials in order of fallback:
1. `DB_SERVER` (required)
2. `DB_USER` (required)
3. `DB_PASSWORD` (required)

### 📝 7. What Happens Now

When you deploy with these fixes:

1. **Dockerfile** starts the FastAPI server automatically
2. **Environment Variables** are loaded by the code
3. **Database** connects via ODBC driver
4. **Email** authenticates via Azure AD credentials
5. **PDF generation** works with Playwright (already in base image)

### ❌ If it Still Fails: Check Logs

```bash
gcloud run services logs read tonnage-report --region us-central1 --limit=100
```

Look for:
- `Auth_ERROR` → Missing Azure credentials
- `DATABASE` errors → DB connection issues
- `File not found` → Missing files in container

---

**Next Step:** Set all required environment variables in Cloud Run, then redeploy.
