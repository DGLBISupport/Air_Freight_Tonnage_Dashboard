# SQL Query Sandbox - User Guide

## Overview
The SQL Query Sandbox allows you to write and execute custom SQL queries directly against the DartBIDW database. Results are automatically visualized in the dashboard with KPI calculations.

## How to Use

### 1. Open the SQL Query Sandbox
- In the dashboard, look for the **"💻 SQL Query Sandbox Console"** section
- Click the **"Expand Editor"** button to open the query editor

### 2. Write or Modify Your Query
- The editor comes pre-populated with a default query (Vietnam exports via Turkish Airline)
- Clear the editor and write your own query, or modify the existing one
- Use standard T-SQL syntax for Microsoft SQL Server

### 3. Execute the Query
- Click the **"Execute Custom SQL"** button
- The button will show a spinning icon while the query runs
- Status messages appear below the button during execution

### 4. View Results
- **Dashboard Updates**: KPIs, charts, and tables automatically update with your query results
- **Data Visualization**: Results are parsed and visualized in:
  - Key Performance Indicators (KPIs)
  - Weekly trend chart
  - Monthly trend chart
  - Detailed results table

## Important Features

### Required Field Mapping
For the dashboard to automatically visualize your results, include at least one of these fields in your SELECT clause:

- `Airline` or `AirlineName1` (airline carrier name)
- `Origin_Country` or `ConLoadPortCountryName` (origin country)
- `Total_Tonnage` or `Tonnage_Chargeable` or `Air_ChargebleWeight` (weight in tons)
- `Total_Revenue` or `Revenue_USD` (revenue in USD)
- `Total_Shipments` or `ShipmentCount` (number of shipments)
- `ETD` or `etd` or `etd_date` (export/transit date for trend grouping)

### Error Handling
- **Empty Query**: The system prevents execution of empty queries
- **Invalid SQL**: SQL syntax errors are caught and displayed in red error boxes
- **Dangerous Operations**: The sandbox prevents execution of:
  - DROP operations
  - DELETE operations
  - INSERT operations
  - UPDATE operations
  - ALTER operations
  - CREATE operations
  - TRUNCATE operations

### Reset Template
- Click **"Reset Template"** to restore the default query template

## Available Database Tables

### Main Tables
- `dbo.ChatData_ViewShipConsolTransport` - Console/shipment transport data
- `dbo.ChatData_ViewShipConsolLink` - Links between consoles and shipments
- `dbo.ChatData_ViewRevandVolume_ShipmentDate` - Revenue and volume by shipment date

### Example Queries

#### Query 1: Revenue by Airline (Past 3 Months)
```sql
SELECT
    vt.AirlineName1 AS Airline,
    SUM(vt.Revenue_USD) AS Total_Revenue,
    SUM(vt.Air_ChargebleWeight) AS Total_Tonnage,
    COUNT(DISTINCT vt.ConsoleNumber) AS Total_Shipments,
    CAST(vt.ETD AS DATE) AS ETD
FROM dbo.ChatData_ViewShipConsolTransport vt
WHERE vt.TransportMode = 'AIR'
    AND vt.ETD >= DATEADD(MONTH, -3, GETDATE())
GROUP BY vt.AirlineName1, CAST(vt.ETD AS DATE)
ORDER BY Total_Revenue DESC
```

#### Query 2: Top Origin Countries by Tonnage
```sql
SELECT
    vt.ConLoadPortCountryName AS Origin_Country,
    SUM(vt.Air_ChargebleWeight) AS Total_Tonnage,
    SUM(vt.Revenue_USD) AS Total_Revenue,
    COUNT(DISTINCT vt.ConsoleNumber) AS Total_Shipments
FROM dbo.ChatData_ViewShipConsolTransport vt
WHERE vt.TransportMode = 'AIR'
GROUP BY vt.ConLoadPortCountryName
ORDER BY Total_Tonnage DESC
```

## Troubleshooting

### Query Doesn't Execute
1. Ensure the query is not empty
2. Check that you're not using DROP, DELETE, INSERT, UPDATE, or ALTER operations
3. Verify SQL syntax is correct for Microsoft SQL Server
4. Ensure the backend API is running on `http://localhost:8000`

### No Results Displayed
1. Your query might have returned 0 rows - check the execution status message
2. Verify the WHERE clause is correct for your time period
3. Check that the table names and column names are spelled correctly

### Connection Error
1. Ensure the FastAPI backend is running:
   ```bash
   python -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
   ```
2. Verify the database connection credentials in your `.env` file
3. Check that the SQL Server is accessible from your machine

## API Details (For Developers)

### Endpoint
```
POST /api/custom-query
```

### Request Body
```json
{
    "query": "SELECT * FROM dbo.ChatData_ViewShipConsolTransport LIMIT 10"
}
```

### Success Response (200)
```json
{
    "status": "success",
    "data": [
        {
            "Console_Number": "CONS001",
            "Airline": "Turkish Airlines",
            "Total_Tonnage": 500.25,
            ...
        }
    ],
    "rowCount": 1
}
```

### Error Response (400)
```json
{
    "detail": "Query execution failed: [Error message]"
}
```

## Security Notes

- The SQL sandbox is read-only; data modification operations are blocked
- All queries run against the DartBIDW database with the configured credentials
- Query execution is logged by the API
- SQL injection attempts are mitigated by using parameterized queries

## Performance Tips

- For large result sets, consider adding LIMIT or TOP clauses to test queries first
- Use date filters to limit the time period you're querying
- Aggregate data where possible to reduce the number of rows returned
- Create appropriate indexes on frequently queried columns

---

For more information, contact your database administrator or check the API documentation.
