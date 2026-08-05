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

import urllib.request

def get_tonnage_base_url() -> str:
    """
    Detects which port the Tonnage Analysis frontend server is running on.
    Probes candidate ports (3001, 3000, 3002, 8000, 8080) to ensure we connect
    to the correct application even if another project is running on port 3000.
    """
    if os.environ.get("K_SERVICE"):
        cloud_run_port = int(os.environ.get("PORT", 8080))
        return f"http://127.0.0.1:{cloud_run_port}"

    custom_url = os.getenv("FRONTEND_BASE_URL")
    if custom_url:
        return custom_url

    # Check candidate ports in local dev
    candidate_ports = [3001, 3000, 3002, 8000, 8080]
    for port in candidate_ports:
        if is_port_open(port):
            try:
                req = urllib.request.Request(f"http://127.0.0.1:{port}/print-view/", headers={"User-Agent": "HealthCheck"})
                with urllib.request.urlopen(req, timeout=1.0) as resp:
                    if resp.status == 200:
                        print(f"Detected Tonnage Analysis print view on port {port}")
                        return f"http://127.0.0.1:{port}"
            except Exception:
                pass

    if is_port_open(3001):
        return "http://127.0.0.1:3001"
    return "http://127.0.0.1:3000"

def generate_dashboard_pdf(
    output_path: str,
    start_date: str = None,
    end_date: str = None,
    country: str = None,
    airline: str = None,
    company_code: str = None,
    origin_city: str = None,
    destination_country: str = None,
    destination_city: str = None,
    branch: str = None,
    include_weekly_visual: bool = True,
    include_weekly_ledger: bool = True,
    include_monthly_visual: bool = True,
    include_monthly_ledger: bool = True,
    include_sector_distribution: bool = True,
    max_data_rows: int = 100,
    mode: str = "standard",
    custom_sql: str = None,
    query_id: str = None,
    report_type: str = "weekly",
):
    """
    Directs a headless browser to the frontend print view and captures a PDF.
    Supports both standard mode (with filters) and custom-sql mode (with SQL query).
    """
    base_url = get_tonnage_base_url()
    
    # Construct the print-optimized frontend URL with filter parameters
    params = {}
    
    # Add mode and query-specific parameters
    if mode == "custom-sql":
        params["mode"] = "custom-sql"
        if query_id:
            params["query_id"] = query_id
        elif custom_sql:
            params["custom_sql"] = custom_sql
        # Pass station identification parameters to custom-sql mode to resolve correct title/labels
        if country: params["country"] = country
        if company_code: params["company_code"] = company_code
        if branch: params["branch"] = branch
    else:
        # Standard mode - add date range and filters
        if start_date: params["start_date"] = start_date
        if end_date: params["end_date"] = end_date
        if country: params["country"] = country
        if airline: params["airline"] = airline
        if company_code: params["company_code"] = company_code
        if origin_city: params["origin_city"] = origin_city
        if destination_country: params["destination_country"] = destination_country
        if destination_city: params["destination_city"] = destination_city
        if branch: params["branch"] = branch
    
    # Add section and row limit parameters (both modes)
    params["include_weekly_visual"] = str(include_weekly_visual).lower()
    params["include_weekly_ledger"] = str(include_weekly_ledger).lower()
    params["include_monthly_visual"] = str(include_monthly_visual).lower()
    params["include_monthly_ledger"] = str(include_monthly_ledger).lower()
    params["include_sector_distribution"] = str(include_sector_distribution).lower()
    params["max_data_rows"] = max_data_rows
    params["report_type"] = report_type
    
    query_string = urllib.parse.urlencode(params)
    target_url = f"{base_url.rstrip('/')}/print-view/?{query_string}"
    
    import sys
    import asyncio
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            
            # Navigate to the frontend UI with increased timeout for data loading
            # Use "load" instead of "networkidle" for faster response
            # Timeout set to 120 seconds (120000ms) for complex SQL queries
            response = page.goto(target_url, wait_until="load", timeout=120000)
            if response and response.status >= 400:
                print(f"Playwright error: {target_url} returned HTTP {response.status}")
                raise RuntimeError(f"Print view page returned HTTP {response.status} for URL: {target_url}")
            
            # Wait for the pdf-ready indicator to ensure data is loaded
            try:
                page.wait_for_selector("#pdf-ready", timeout=120000)
            except Exception:
                print("Warning: pdf-ready indicator not found, proceeding with PDF capture anyway")
            
            # Add a small delay to ensure all rendering is complete
            page.wait_for_timeout(1000)
            
            # Save as a landscape A4 PDF
            page.pdf(path=output_path, format="A4", landscape=True, print_background=True)
            browser.close()
    except Exception as e:
        print(f"PDF Generation Error: {str(e)}")
        raise