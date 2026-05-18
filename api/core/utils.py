"""
Utility functions for Master Organization Mapper.
Includes text cleaning, abbreviation generators, dynamic Excel reading, and column detection.
"""

import pandas as pd
from io import BytesIO


# ---------- Text cleaning ----------

def clean_text(text):
    """
    Fungsi TRIM seperti di Excel:
    Menghapus spasi berlebih di awal/akhir dan mengganti spasi ganda di tengah.
    """
    if pd.isna(text):
        return ""
    return " ".join(str(text).strip().split())


# ---------- Company abbreviation ----------

IGNORE_WORDS = {"PT", "CV", "TBK", "UD", "FIRMA", "LLC", "INC", "LTD", "CORP"}

def generate_company_abbreviation(company_name: str) -> str:
    """Menghasilkan singkatan Company (misal: PT Lensa Utama Indonesia -> LUI)."""
    if pd.isna(company_name) or company_name == "":
        return ""
    words = company_name.upper().replace(".", "").split()
    abbr = "".join(w[0] for w in words if w not in IGNORE_WORDS)
    return abbr if abbr else company_name.upper()[:3]


# ---------- Location code ----------

DEFAULT_LOCATION_MAP = {
    "JAKARTA": "JKT", "YOGYAKARTA": "YOG", "SURABAYA": "SBY",
    "BANDUNG": "BDG", "SEMARANG": "SMG", "MEDAN": "MDN",
    "MAKASSAR": "MKS", "BALI": "BLI", "DENPASAR": "DPS",
    "TANGERANG": "TGR", "BEKASI": "BKS", "DEPOK": "DPK",
    "BOGOR": "BGR", "PALEMBANG": "PLB", "MALANG": "MLG",
    "SOLO": "SLO", "SURAKARTA": "SLO", "BALIKPAPAN": "BPN",
    "PONTIANAK": "PTK", "MANADO": "MND", "LAMPUNG": "LPG",
    "BATAM": "BTM", "PEKANBARU": "PKU", "PADANG": "PDG",
    "CIREBON": "CRB", "PURWOKERTO": "PWT",
}

def generate_location_code(location_name: str, custom_map: dict | None = None) -> str:
    """Menghasilkan kode lokasi dari nama kota."""
    if pd.isna(location_name) or location_name == "":
        return ""
    loc_upper = str(location_name).strip().upper()
    if custom_map and loc_upper in custom_map:
        return custom_map[loc_upper]
    return DEFAULT_LOCATION_MAP.get(loc_upper, loc_upper[:3].upper())


# ---------- Default level ordering ----------

DEFAULT_LEVEL_ORDER = {
    "SENIOR MANAGER": 1,
    "MANAGER": 2,
    "ASST. MANAGER": 3,
    "ASSISTANT MANAGER": 3,
    "ASST MANAGER": 3,
    "SPV": 4,
    "SUPERVISOR": 4,
    "STAFF": 5,
}


# ---------- Dynamic Excel reading ----------

def read_excel_dynamic(
    file_bytes: bytes,
    sheet_name: str,
    header_row: int = 2,
    data_start_row: int = 3,
    col_start: int | None = None,
    col_end: int | None = None,
) -> pd.DataFrame:
    """
    Read Excel with configurable header and data positions.
    header_row and data_start_row are 1-indexed (Excel-style).
    """
    buf = BytesIO(file_bytes)
    # Read with header at the specified row (pandas uses 0-indexed)
    # dtype=str preserves leading zeros (e.g., NoPegawai "0930022")
    df = pd.read_excel(
        buf,
        sheet_name=sheet_name,
        header=header_row - 1,
        dtype=str,
    )

    # Skip rows between header and data_start_row
    skip = data_start_row - header_row - 1
    if skip > 0:
        df = df.iloc[skip:]
        df = df.reset_index(drop=True)

    # Slice columns if requested
    if col_start is not None and col_end is not None:
        df = df.iloc[:, (col_start - 1):col_end]
    elif col_start is not None:
        df = df.iloc[:, (col_start - 1):]

    # Drop fully-empty rows
    df = df.dropna(how="all").reset_index(drop=True)
    return df


# ---------- Auto-detect column mapping ----------

TARGET_FIELDS = [
    "Company", "Directorate", "Division", "Department",
    "Section", "Location", "Level", "Job Title", "Position",
]

def detect_column_mapping(df: pd.DataFrame) -> dict:
    """
    Try to auto-map target fields to actual column names using case-insensitive matching.
    Returns dict: {target_field: actual_column_name or None}.
    """
    mapping = {}
    cols_lower = {str(c).strip().lower(): c for c in df.columns}
    for field in TARGET_FIELDS:
        key = field.lower()
        if key in cols_lower:
            mapping[field] = cols_lower[key]
        else:
            # Try partial match
            matches = [c for k, c in cols_lower.items() if key in k or k in key]
            mapping[field] = matches[0] if matches else None
    return mapping


def get_sheet_names(file_bytes: bytes) -> list[str]:
    """Return list of sheet names from an Excel file."""
    buf = BytesIO(file_bytes)
    xl = pd.ExcelFile(buf)
    return xl.sheet_names


def read_raw_preview(file_bytes: bytes, sheet_name: str, nrows: int = 10) -> pd.DataFrame:
    """Read raw data without header config, for preview purposes."""
    buf = BytesIO(file_bytes)
    df = pd.read_excel(buf, sheet_name=sheet_name, header=None, nrows=nrows)
    return df
