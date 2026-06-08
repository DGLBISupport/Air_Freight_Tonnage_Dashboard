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

def send_pdf_via_graph(pdf_path: str, recipient_email: str):
    """
    Authenticates via MSAL and sends an email with the attached PDF using MS Graph API.
    """
    tenant_id = os.getenv("AZURE_TENANT_ID")
    client_id = os.getenv("AZURE_CLIENT_ID")
    client_secret = os.getenv("AZURE_CLIENT_SECRET")
    sender = os.getenv("SENDER_EMAIL")
    
    try:
        # Authenticate with Azure
        app = ConfidentialClientApplication(client_id, authority=f"https://login.microsoftonline.com/{tenant_id}", client_credential=client_secret)
        result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
        
        if "access_token" not in result:
            err = "Could not acquire Azure token. Check credentials."
            log_email_transaction(recipient_email, "AUTH_ERROR", err)
            raise Exception(err)
        
        # Read the PDF into Base64 format
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()
        b64_pdf = base64.b64encode(pdf_bytes).decode('utf-8')
        
        # Prepare MS Graph Email Payload
        recipients_list = [email.strip() for email in recipient_email.split(",") if email.strip()]
        to_recipients = [{"emailAddress": {"address": email}} for email in recipients_list]
        
        email_msg = {
            "message": {
                "subject": "Weekly Air Freight Performance Report",
                "body": {
                    "contentType": "Text",
                    "content": "Hello,\n\nPlease find your requested custom tonnage dashboard view attached.\n\nBest Regards,\nBI Support Team"
                },
                "toRecipients": to_recipients,
                "attachments": [
                    {
                        "@odata.type": "#microsoft.graph.fileAttachment",
                        "name": "Custom_Tonnage_Dashboard.pdf",
                        "contentType": "application/pdf",
                        "contentBytes": b64_pdf
                    }
                ]
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