import os
import base64
import requests
import datetime
from msal import ConfidentialClientApplication

def log_email_transaction(recipient: str, status: str, details: str = ""):
    """Writes persistent, clear transaction entries to logs/email_history.log."""
    os.makedirs("logs", exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_entry = f"[{timestamp}] RECIPIENT: {recipient} | STATUS: {status} | DETAILS: {details}\n"
    with open("logs/email_history.log", "a", encoding="utf-8") as f:
        f.write(log_entry)

def send_pdf_via_graph(
    pdf_path: str = None,
    recipient_email: str = "",
    subject: str = "Weekly Air Freight Performance Report",
    body: str = "Dear {recipient_name},\n\nPlease find your requested custom tonnage dashboard view attached.\n\nBest Regards,\nBI Support Team",
    attachment_name: str = "Custom_Tonnage_Dashboard.pdf",
    attachments: list = None
):
    """
    Authenticates via MSAL and sends an email with the attached PDF(s) using MS Graph API.
    Supports either a single pdf_path or a list of dicts: [{"path": ..., "name": ...}].
    """
    tenant_id = os.getenv("MAIL_AZURE_TENANT_ID") or os.getenv("AZURE_TENANT_ID")
    client_id = os.getenv("MAIL_AZURE_CLIENT_ID") or os.getenv("AZURE_CLIENT_ID")
    client_secret = os.getenv("MAIL_AZURE_CLIENT_SECRET") or os.getenv("AZURE_CLIENT_SECRET")
    sender = os.getenv("SENDER_EMAIL")
    
    try:
        # Validate required environment variables
        missing_vars = []
        if not tenant_id:
            missing_vars.append("MAIL_AZURE_TENANT_ID or AZURE_TENANT_ID")
        if not client_id:
            missing_vars.append("MAIL_AZURE_CLIENT_ID or AZURE_CLIENT_ID")
        if not client_secret:
            missing_vars.append("MAIL_AZURE_CLIENT_SECRET or AZURE_CLIENT_SECRET")
        if not sender:
            missing_vars.append("SENDER_EMAIL")
        
        if missing_vars:
            err = f"Missing environment variables: {', '.join(missing_vars)}. Please set these in Cloud Run environment variables."
            log_email_transaction(recipient_email, "CONFIG_ERROR", err)
            print(f"[ERROR] {err}")
            raise Exception(err)
        # Authenticate with Azure
        app = ConfidentialClientApplication(client_id, authority=f"https://login.microsoftonline.com/{tenant_id}", client_credential=client_secret)
        result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
        
        if "access_token" not in result:
            err = "Could not acquire Azure token. Check credentials."
            log_email_transaction(recipient_email, "AUTH_ERROR", err)
            raise Exception(err)
        
        # Prepare attachments
        email_attachments = []
        if attachments:
            for item in attachments:
                item_path = item.get("path")
                item_name = item.get("name", "Report.pdf")
                if item_path and os.path.exists(item_path):
                    with open(item_path, "rb") as f:
                        file_bytes = f.read()
                    email_attachments.append({
                        "@odata.type": "#microsoft.graph.fileAttachment",
                        "name": item_name,
                        "contentType": "application/pdf",
                        "contentBytes": base64.b64encode(file_bytes).decode('utf-8')
                    })
        elif pdf_path and os.path.exists(pdf_path):
            with open(pdf_path, "rb") as f:
                pdf_bytes = f.read()
            email_attachments.append({
                "@odata.type": "#microsoft.graph.fileAttachment",
                "name": attachment_name,
                "contentType": "application/pdf",
                "contentBytes": base64.b64encode(pdf_bytes).decode('utf-8')
            })
        
        # Prepare MS Graph Email Payload
        recipients_list = [email.strip() for email in recipient_email.split(",") if email.strip()]
        to_recipients = [{"emailAddress": {"address": email}} for email in recipients_list]
        
        email_msg = {
            "message": {
                "subject": subject,
                "body": {
                    "contentType": "Text",
                    "content": body
                },
                "toRecipients": to_recipients,
                "attachments": email_attachments
            },
            "saveToSentItems": "true"
        }
        
        headers = {
            "Authorization": f"Bearer {result['access_token']}",
            "Content-Type": "application/json"
        }
        
        endpoint = f"https://graph.microsoft.com/v1.0/users/{sender}/sendMail"
        response = requests.post(endpoint, headers=headers, json=email_msg)
        
        if response.status_code == 202:
            log_email_transaction(recipient_email, "SUCCESS", "Dispatched successfully via MS Graph sendMail (HTTP 202).")
        else:
            err_details = f"HTTP {response.status_code}: {response.text}"
            log_email_transaction(recipient_email, "SEND_FAILED", err_details)
            raise Exception(f"Failed to send email: {err_details}")
            
    except Exception as e:
        log_email_transaction(recipient_email, "CRASHED", str(e))
        raise