from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
from io import BytesIO
from openpyxl import load_workbook

app = FastAPI()

@app.post("/api/analyze")
async def analyze(file: UploadFile = File(...)):
    contents = await file.read()
    try:
        buf = BytesIO(contents)
        wb = load_workbook(buf, read_only=True, data_only=True)
        sheets = wb.sheetnames
        
        result = {}
        for sheet in sheets:
            ws = wb[sheet]
            
            # Read first 10 rows for preview
            data = []
            for i, row in enumerate(ws.iter_rows(min_row=1, max_row=10, values_only=True)):
                data.append([str(cell) if cell is not None else "" for cell in row])
            
            # Extract headers from first 3 rows for column mapping
            headers = []
            for row in data[:3]:
                for cell in row:
                    if str(cell).strip():
                        headers.append(str(cell).strip())
            
            # Pad rows with empty strings so they are all the same length
            max_cols = max([len(r) for r in data]) if data else 0
            padded_data = [r + [""] * (max_cols - len(r)) for r in data]
            
            result[sheet] = {
                "columns": list(dict.fromkeys(headers)),
                "preview": padded_data
            }
            
        return JSONResponse({"sheets": result})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=400)
