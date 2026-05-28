import os
from playwright.sync_api import sync_playwright

def generate_sql_doc(output_path):
    sql_text = """
    -- Revenue and Tonnage of Shipments Exported from Vietnam using Turkish Airline
    -- Period: June 1, 2025 to May 21, 2026
    -- Linked through ChatData_ViewShipConsolLink
    -- INCLUDES consolidations without linked shipments in ChatData_ViewRevandVolume_ShipmentDate
    
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
        AND vt.ETD <= '2026-05-21'
        AND vt.AirlineName1 LIKE '%Turkish%'
        AND vt.TransportMode = 'AIR'
    GROUP BY vt.ConsoleNumber, vt.MasterBillNum, vt.AirlineName1, vt.ConsolTransportMode, vt.ETD, vt.ConLoadPortCountryName, vt.Air_ChargebleWeight, vt.Air_ActualWeight, vt.Revenue_USD, vt.Cost_USD, vt.Profit_USD
    ORDER BY vt.ETD DESC, vt.Revenue_USD DESC;
    """

    html_content = f"""
    <html>
    <head>
        <style>
            body {{ font-family: monospace; background-color: #1e1e1e; color: #d4d4d4; padding: 40px; }}
            pre {{ white-space: pre-wrap; }}
        </style>
    </head>
    <body>
        <h2>SQL Query Documentation</h2>
        <pre>{sql_text}</pre>
    </body>
    </html>
    """

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_content(html_content)
        page.pdf(path=output_path, format="A4")
        browser.close()

if __name__ == "__main__":
    generate_sql_doc("outputs/SQL_Query_Documentation.pdf")
    print("SQL Documentation PDF created successfully.")