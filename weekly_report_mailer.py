import os
import urllib.parse
import pandas as pd
import requests
import base64
import logging
from sqlalchemy import create_engine
from dotenv import load_dotenv
from msal import ConfidentialClientApplication
from playwright.sync_api import sync_playwright
from jinja2 import Environment, FileSystemLoader

# --- SETUP: Directories and Logging ---
os.makedirs("logs", exist_ok=True)
os.makedirs("outputs", exist_ok=True)

logging.basicConfig(
    filename='logs/service.log',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# Load environment variables
load_dotenv(override=True)

# --- 1. DATA EXTRACTION ---
def fetch_data():
    logging.info("Connecting to SQL Server to fetch tonnage data...")
    try:
        db_pass = urllib.parse.quote_plus(os.getenv("DB_PASSWORD"))
        db_server = os.getenv("DB_SERVER")
        db_name = os.getenv("DB_NAME")
        db_user = os.getenv("DB_USER")
        
        conn_str = f"mssql+pyodbc:///?odbc_connect=DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={db_server};DATABASE={db_name};UID={db_user};PWD={db_pass}"
        engine = create_engine(conn_str)
        
        query = """
        SELECT
            vt.ConsoleNumber AS Console_Number,
            vt.MasterBillNum AS Master_Airway_Bill,
            vt.AirlineName1 AS Airline,
            vt.ConsolTransportMode AS Transport_Mode,
            vt.ETD,
            vt.ConLoadPortCountryName AS Origin_Country,
            COALESCE(MAX(vs.OriginCity), 'N/A') AS Origin_City,
            COALESCE(MAX(vs.DestCity), 'N/A') AS Destination_City,
            COALESCE(MAX(vs.DestCountry), 'N/A') AS Destination_Country,
            COALESCE(MAX(vs.Company), 'Unlinked') AS Company_Code,
            COUNT(DISTINCT vs.ShipmentNumber) AS Total_Shipments,
            ROUND(vt.Air_ChargebleWeight, 2) AS Tonnage_Chargeable,
            ROUND(vt.Air_ActualWeight, 2) AS Tonnage_Actual,
            ROUND(vt.Revenue_USD, 2) AS Revenue_USD,
            ROUND(vt.Cost_USD, 2) AS Cost_USD,
            ROUND(vt.Profit_USD, 2) AS Profit_USD,
            ROUND((vt.Profit_USD / NULLIF(vt.Revenue_USD, 0)) * 100, 2) AS GP_Margin_Percent,
            CASE 
                WHEN COUNT(DISTINCT vs.ShipmentNumber) = 0 THEN 'No Linked Shipments'
                ELSE 'Linked'
            END AS Shipment_Link_Status
        FROM dbo.ChatData_ViewShipConsolTransport vt
        LEFT JOIN dbo.ChatData_ViewShipConsolLink vsc ON vsc.Link_ConsolNumber = vt.ConsoleNumber
        LEFT JOIN dbo.ChatData_ViewRevandVolume_ShipmentDate vs ON vs.ShipmentNumber = vsc.Link_ShipmentNum
        WHERE vt.ConLoadPortCountryName = 'Viet Nam'
            AND vt.ETD >= '2025-06-01'
            AND vt.ETD <= '2026-06-07'
            AND vt.AirlineName1 LIKE '%Turkish%'
            AND vt.TransportMode = 'AIR'
        GROUP BY vt.ConsoleNumber, vt.MasterBillNum, vt.AirlineName1, vt.ConsolTransportMode, vt.ETD, vt.ConLoadPortCountryName, vt.Air_ChargebleWeight, vt.Air_ActualWeight, vt.Revenue_USD, vt.Cost_USD, vt.Profit_USD
        ORDER BY vt.ETD DESC, vt.Revenue_USD DESC;
        """
        df = pd.read_sql(query, engine)
        logging.info(f"Successfully fetched {len(df)} records.")
        return df
    except Exception as e:
        logging.error(f"Failed to fetch data: {e}")
        raise

# --- 2. PDF GENERATION ---
def generate_pdf(df, output_path):
    logging.info("Generating PDF dashboard via Playwright...")
    try:
        # Load the HTML template
        env = Environment(loader=FileSystemLoader('templates'))
        template = env.get_template('dashboard.html')
        
        # Convert DataFrame to HTML table
        html_table = df.to_html(index=False, classes='data-table')
        
        # Render template with data
        rendered_html = template.render(table_data=html_table)
        
        # Print to PDF
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            page.set_content(rendered_html)
            page.pdf(path=output_path, format="A4", landscape=True, print_background=True)
            browser.close()
        logging.info(f"PDF successfully saved to {output_path}")
    except Exception as e:
        logging.error(f"Failed to generate PDF: {e}")
        raise

# --- 3. GRAPH API EMAIL DISTRIBUTION ---
def send_email_via_graph(pdf_path):
    logging.info("Authenticating with Microsoft Graph API...")
    try:
        tenant_id = os.getenv("MAIL_AZURE_TENANT_ID") or os.getenv("AZURE_TENANT_ID")
        client_id = os.getenv("MAIL_AZURE_CLIENT_ID") or os.getenv("AZURE_CLIENT_ID")
        client_secret = os.getenv("MAIL_AZURE_CLIENT_SECRET") or os.getenv("AZURE_CLIENT_SECRET")
        sender = os.getenv("SENDER_EMAIL")
        recipients = os.getenv("RECIPIENT_EMAILS").split(',')
        
        # Authenticate with MSAL
        app = ConfidentialClientApplication(client_id, authority=f"https://login.microsoftonline.com/{tenant_id}", client_credential=client_secret)
        result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
        
        if "access_token" not in result:
            raise Exception("Could not acquire Azure token. Check credentials and App Permissions (Mail.Send).")
        
        logging.info("Preparing email payload...")
        # Read PDF to base64
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()
        b64_pdf = base64.b64encode(pdf_bytes).decode('utf-8')
        
        to_recipients = [{"emailAddress": {"address": email.strip()}} for email in recipients]
        
        email_msg = {
            "message": {
                "subject": "Weekly Tonnage Analysis Report - Turkish Airlines",
                "body": {
                    "contentType": "Text",
                    "content": "Hello,\n\nPlease find attached the weekly tonnage and revenue report for Turkish Airlines out of Vietnam.\n\nBest Regards,\nBI Support Team"
                },
                "toRecipients": to_recipients,
                "attachments": [
                    {
                        "@odata.type": "#microsoft.graph.fileAttachment",
                        "name": "Weekly_Tonnage_Analysis.pdf",
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
            logging.info("Report sent successfully via Microsoft Graph!")
        else:
            logging.error(f"Failed to send email: {response.text}")
            
    except Exception as e:
        logging.error(f"Email distribution failed: {e}")
        raise

# --- MAIN EXECUTION ---
if __name__ == "__main__":
    logging.info("--- Starting Weekly Report Job ---")
    pdf_file_path = "outputs/Weekly_Tonnage_Report.pdf"
    
    try:
        report_data = fetch_data()
        generate_pdf(report_data, pdf_file_path)
        send_email_via_graph(pdf_file_path)
        logging.info("--- Weekly Report Job Completed Successfully ---")
    except Exception as e:
        logging.critical("Job terminated with errors. Please check the logs.")