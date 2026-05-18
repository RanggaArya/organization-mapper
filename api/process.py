from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import Response, JSONResponse
import json
import pandas as pd
from io import BytesIO

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
        
        buf = BytesIO(contents)
        df = pd.read_excel(buf, sheet_name=sheet_name, header=header_row - 1)
        
        processor = MappingProcessor(df, mapping_config)
        df_result = processor.process()
        
        out_bytes = build_excel_output(
            contents,
            sheet_name,
            df_result,
            header_row=header_row,
            data_start_row=data_start_row
        )
        
        filename = file.filename or "Master_Organization_MAPPED.xlsx"
        if not filename.endswith("_MAPPED.xlsx"):
            filename = filename.replace(".xlsx", "_MAPPED.xlsx")
            
        return Response(
            content=out_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=400)
