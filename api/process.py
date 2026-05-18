from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import Response, JSONResponse
import json
import pandas as pd
from io import BytesIO
import sys
import os
import base64
import time

# Ensure the api folder is in the Python path
sys.path.append(os.path.dirname(__file__))
from core.processor import MappingConfig, MappingProcessor, build_excel_output

app = FastAPI()

@app.post("/api/process")
async def process(file: UploadFile = File(...), config: str = Form(...)):
    try:
        contents = await file.read()
        cfg_dict = json.loads(config)
        
        sheet_name = cfg_dict.get("sheet_name", "Sheet1")
        header_row = int(cfg_dict.get("header_row", 2))
        data_start_row = int(cfg_dict.get("data_start_row", 3))
        
        mapping_config = MappingConfig(
            column_mapping=cfg_dict.get("column_mapping", {}),
            code_mode=cfg_dict.get("code_mode", "default"),
            company_prefixes=cfg_dict.get("company_prefixes", {}),
            start_number=int(cfg_dict.get("start_number", 1)),
            digit_count=int(cfg_dict.get("digit_count", 4)),
            ascending=bool(cfg_dict.get("ascending", True)),
            level_order=cfg_dict.get("level_order", {}),
            company_codes=cfg_dict.get("company_codes", {}),
            location_codes=cfg_dict.get("location_codes", {}),
            use_company_prefix=bool(cfg_dict.get("use_company_prefix", False))
        )
        
        start_time = time.time()
        buf = BytesIO(contents)
        df = pd.read_excel(buf, sheet_name=sheet_name, header=header_row - 1, dtype=str)
        # Strip column names to match the mapping which comes from stripped headers
        df.columns = [str(c).strip() for c in df.columns]
        
        processor = MappingProcessor(df, mapping_config)
        df_result = processor.process()
        
        out_bytes = build_excel_output(
            contents,
            sheet_name,
            df_result,
            header_row=header_row,
            data_start_row=data_start_row
        )
        
        # Prepare JSON response
        b64 = base64.b64encode(out_bytes).decode("utf-8")
        
        preview_df = df_result.head(50).fillna("")
        preview_data = preview_df.values.tolist()
        columns = preview_df.columns.tolist()
        
        unique_companies = df_result["Code Company"].nunique() if "Code Company" in df_result.columns else 0
        unique_codes = df_result["Code Position"].nunique() if "Code Position" in df_result.columns else len(df_result)
        
        return JSONResponse({
            "excel_base64": b64,
            "preview_data": preview_data,
            "preview_columns": columns,
            "stats": {
                "total_rows": len(df_result),
                "companies": unique_companies,
                "unique_codes": unique_codes,
                "time": round(time.time() - start_time, 2)
            }
        })
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=400)
