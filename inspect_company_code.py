import os
import urllib.parse
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

# Build the connection engine once
db_pass = urllib.parse.quote_plus(os.getenv("DB_PASSWORD", ""))
db_server = os.getenv("DB_SERVER", "")
db_name = "DartBIDW"
db_user = os.getenv("DB_USER", "")

conn_str = f"mssql+pyodbc:///?odbc_connect=DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={db_server};DATABASE={db_name};UID={db_user};PWD={db_pass}"
engine = create_engine(conn_str)

print("Connecting and querying Dim_DGLCompany...")
try:
    with engine.connect() as conn:
        print("\nDim_DGLCompany values (top 15):")
        result = conn.execute(text("SELECT TOP 15 DGL_Company, DGL_CompanyName FROM [DartCusSurvey].[dbo].[Dim_DGLCompany]"))
        for row in result:
            print(f" - Code: {row[0]}, Name: {row[1]}")
            
        print("\nLet's check unique values of ThreeLetterCode in ViewShipConsolTransport:")
        result = conn.execute(text("SELECT DISTINCT TOP 15 ThreeLetterCode FROM dbo.ChatData_ViewShipConsolTransport"))
        for row in result:
            print(f" - {row[0]}")
            
        print("\nLet's check unique values of LastEditUser or other columns in ViewShipConsolTransport to see if there is any DGL Company match:")
        # Let's inspect some row values where the forwarder starts with DARGLO:
        result = conn.execute(text("SELECT TOP 5 SendingForwarder, ThreeLetterCode, TwoCharacterCode FROM dbo.ChatData_ViewShipConsolTransport"))
        for row in result:
            print(f" - SendingForwarder: {row[0]}, ThreeLetterCode: {row[1]}, TwoCharacterCode: {row[2]}")
            
except Exception as e:
    import traceback
    traceback.print_exc()
