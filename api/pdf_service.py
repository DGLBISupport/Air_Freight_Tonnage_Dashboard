import os
import socket
import urllib.parse
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

load_dotenv()

def is_port_open(port: int) -> bool:
    """Checks if a local port is actively open and listening."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.3)
        return s.connect_ex(('127.0.0.1', port)) == 0

def generate_dashboard_pdf(
    start_date: str,
    end_date: str,
    country: str,
    airline: str,
    output_path: str,
    company_code: str = None,
    origin_city: str = None,
    destination_country: str = None,
    destination_city: str = None,
    branch: str = None,
):
    """
    Directs a headless browser to the frontend print view and captures a PDF.
    """
    # Auto-detect if port 3001 is active instead of 3000
    detected_port = 3000
    if is_port_open(3001) and not is_port_open(3000):
        detected_port = 3001
        
    base_url = os.getenv("FRONTEND_BASE_URL", f"http://localhost:{detected_port}")
    
    # Construct the print-optimized frontend URL with filter parameters
    params = {
        "start_date": start_date,
        "end_date": end_date
    }
    if country: params["country"] = country
    if airline: params["airline"] = airline
    if company_code: params["company_code"] = company_code
    if origin_city: params["origin_city"] = origin_city
    if destination_country: params["destination_country"] = destination_country
    if destination_city: params["destination_city"] = destination_city
    if branch: params["branch"] = branch
    
    query_string = urllib.parse.urlencode(params)
    target_url = f"{base_url}/print-view?{query_string}"
    
    import sys
    import asyncio
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Navigate to the frontend UI
        page.goto(target_url, wait_until="networkidle")
        
        # Save as a landscape A4 PDF
        page.pdf(path=output_path, format="A4", landscape=True, print_background=True)
        browser.close()