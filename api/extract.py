from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
import pandas as pd
from io import BytesIO
import json

app = FastAPI()

@app.post("/api/extract")
async def extract(file: UploadFile = File(...), config: str = Form(...)):
    try:
        contents = await file.read()
        cfg_dict = json.loads(config)
        
        sheet_name = cfg_dict.get("sheet_name", "Sheet1")
        header_row = int(cfg_dict.get("header_row", 2))
        mapping = cfg_dict.get("column_mapping", {})
        
        buf = BytesIO(contents)
        df = pd.read_excel(buf, sheet_name=sheet_name, header=header_row - 1)
        
        # Strip column names to match the mapping which comes from stripped headers
        df.columns = [str(c).strip() for c in df.columns]
        
        # Get target column names
        comp_col = mapping.get("Company")
        lev_col = mapping.get("Level")
        loc_col = mapping.get("Location")
        
        # Extract unique values
        companies = df[comp_col].dropna().unique().tolist() if comp_col and comp_col in df.columns else []
        levels = df[lev_col].dropna().unique().tolist() if lev_col and lev_col in df.columns else []
        locations = df[loc_col].dropna().unique().tolist() if loc_col and loc_col in df.columns else []
        
        # Clean values
        companies = [str(c).strip() for c in companies if str(c).strip()]
        levels = sorted(list(set(str(l).strip().upper() for l in levels if str(l).strip())))
        locations = [str(l).strip() for l in locations if str(l).strip()]
        
        # Count levels
        level_counts = {}
        if lev_col and lev_col in df.columns:
            for lev in levels:
                count = len(df[df[lev_col].apply(lambda x: str(x).strip().upper() if not pd.isna(x) else "") == lev])
                level_counts[lev] = count
                
        # Generate data preview
        preview_df = df.head(50).fillna("")
        preview_data = preview_df.values.tolist()
        columns = preview_df.columns.tolist()
                
        return JSONResponse({
            "companies": companies,
            "levels": levels,
            "level_counts": level_counts,
            "locations": locations,
            "preview_data": preview_data,
            "preview_columns": columns,
            "total_rows": len(df),
            "total_cols": len(columns)
        })
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=400)
