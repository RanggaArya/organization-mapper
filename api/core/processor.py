"""
Core mapping processor — refactored from excel_mapping_v1.py.
Accepts a MappingConfig dataclass so every parameter is dynamic.
"""

from __future__ import annotations

import string
from copy import copy
from dataclasses import dataclass, field
from io import BytesIO

import pandas as pd
from openpyxl import Workbook, load_workbook
from openpyxl.styles import PatternFill, Font, Alignment

from .utils import clean_text, generate_company_abbreviation, generate_location_code


# ──────────────────────── Config ────────────────────────

@dataclass
class MappingConfig:
    """All user-configurable options collected from the UI wizard."""

    column_mapping: dict[str, str | None]  # target_field -> actual col name
    code_mode: str = "default"             # "default" | "custom"
    company_prefixes: dict[str, str] = field(default_factory=dict)
    start_number: int = 1
    digit_count: int = 4
    ascending: bool = True
    level_order: dict[str, int] = field(default_factory=dict)
    company_codes: dict[str, str] = field(default_factory=dict)
    location_codes: dict[str, str] = field(default_factory=dict)
    use_company_prefix: bool = False


# ──────────────────── Sequence Generator ────────────────

class FlexibleSequenceGenerator:
    """Generate unique sequential codes, optionally with a per-company prefix."""

    def __init__(
        self,
        use_prefix: bool = False,
        start_number: int = 1,
        digit_count: int = 4,
        ascending: bool = True,
    ):
        self.lookup: dict[str, str] = {}
        self.counters: dict[str, int] = {}
        self.use_prefix = use_prefix
        self.start_number = start_number
        self.digit_count = digit_count
        self.ascending = ascending

    def get_code(self, key: str, prefix: str = "") -> str:
        if pd.isna(key) or key == "":
            return ""
        if key not in self.lookup:
            if prefix not in self.counters:
                self.counters[prefix] = self.start_number
            seq = self.counters[prefix]
            if self.ascending:
                self.counters[prefix] += 1
            else:
                self.counters[prefix] -= 1

            if self.use_prefix and prefix:
                self.lookup[key] = f"{prefix}{seq:0{self.digit_count}d}"
            else:
                # Without prefix, use digit_count+1 (or just digit_count for custom)
                width = self.digit_count + (1 if not self.use_prefix else 0)
                self.lookup[key] = f"{seq:0{width}d}"
        return self.lookup[key]


# ──────────────────── Mapping Processor ─────────────────

class MappingProcessor:
    """Run the full mapping pipeline on a DataFrame."""

    def __init__(self, df: pd.DataFrame, config: MappingConfig):
        self.df = df.copy()
        self.cfg = config
        self.col = config.column_mapping  # shorthand
        self.use_prefix = False
        self.company_prefix_map: dict[str, str] = {}

    # ── helpers ──

    def _c(self, target_field: str) -> str | None:
        """Return the actual column name for a target field, or None."""
        return self.col.get(target_field)

    def _safe_get(self, row, field: str):
        col = self._c(field)
        if col and col in row.index:
            val = row[col]
            return "" if pd.isna(val) else str(val)
        return ""

    def _code_col(self, field: str) -> str:
        return f"Code {field}"

    # ── pipeline ──

    def process(self) -> pd.DataFrame:
        self._clean()
        self._setup_companies()
        self._generate_all_codes()
        return self._arrange_columns()

    def _clean(self):
        for col in self.df.columns:
            self.df[col] = self.df[col].apply(clean_text)

    def _setup_companies(self):
        comp_col = self._c("Company")
        if not comp_col or comp_col not in self.df.columns:
            return

        unique = [c for c in self.df[comp_col].unique() if c and not pd.isna(c) and str(c).strip()]
        multi = len(unique) > 1

        if self.cfg.code_mode == "default":
            if multi:
                self.use_prefix = True
                letters = list(string.ascii_uppercase)
                for i, comp in enumerate(unique):
                    if i < 26:
                        self.company_prefix_map[comp] = letters[i]
                    else:
                        self.company_prefix_map[comp] = letters[i // 26 - 1] + letters[i % 26]
            else:
                self.use_prefix = False
                for comp in unique:
                    self.company_prefix_map[comp] = ""
        else:
            # Custom mode
            self.use_prefix = self.cfg.use_company_prefix and multi
            self.company_prefix_map = dict(self.cfg.company_prefixes)
            # Fill missing companies with empty prefix
            for comp in unique:
                if comp not in self.company_prefix_map:
                    self.company_prefix_map[comp] = ""

    def _make_gen(self) -> FlexibleSequenceGenerator:
        return FlexibleSequenceGenerator(
            use_prefix=self.use_prefix,
            start_number=self.cfg.start_number,
            digit_count=self.cfg.digit_count,
            ascending=self.cfg.ascending,
        )

    def _generate_all_codes(self):
        comp_col = self._c("Company")
        dir_col = self._c("Directorate")
        div_col = self._c("Division")
        dep_col = self._c("Department")
        sec_col = self._c("Section")
        loc_col = self._c("Location")
        lev_col = self._c("Level")
        jt_col = self._c("Job Title")
        pos_col = self._c("Position")

        gen_dir = self._make_gen()
        gen_div = self._make_gen()
        gen_dep = self._make_gen()
        gen_sec = self._make_gen()
        gen_jt = self._make_gen()
        gen_pos = self._make_gen()

        # Temp column for company prefix used during lookups
        if comp_col and comp_col in self.df.columns:
            self.df["__comp_pfx"] = self.df[comp_col].map(
                lambda c: self.company_prefix_map.get(c, "") if not pd.isna(c) else ""
            )
        else:
            self.df["__comp_pfx"] = ""

        # 1. Code Company
        if comp_col and comp_col in self.df.columns:
            if self.cfg.code_mode == "custom" and self.cfg.company_codes:
                self.df[self._code_col("Company")] = self.df[comp_col].map(
                    lambda c: self.cfg.company_codes.get(c, generate_company_abbreviation(c)) if not pd.isna(c) else ""
                )
            else:
                self.df[self._code_col("Company")] = self.df[comp_col].apply(generate_company_abbreviation)

        # 2. Code Directorate
        if dir_col and dir_col in self.df.columns:
            self.df[self._code_col("Directorate")] = self.df.apply(
                lambda r: gen_dir.get_code(
                    f"{r.get('__comp_pfx', '')}_{r.get(dir_col, '')}",
                    r.get("__comp_pfx", ""),
                ), axis=1,
            )

        # 3. Code Division
        if div_col and div_col in self.df.columns:
            code_dir = self._code_col("Directorate")
            self.df[self._code_col("Division")] = self.df.apply(
                lambda r: gen_div.get_code(
                    f"{r.get(code_dir, '')}_{r.get(div_col, '')}",
                    r.get("__comp_pfx", ""),
                ), axis=1,
            )

        # 4. Code Department
        if dep_col and dep_col in self.df.columns:
            code_div = self._code_col("Division")
            self.df[self._code_col("Department")] = self.df.apply(
                lambda r: gen_dep.get_code(
                    f"{r.get(code_div, '')}_{r.get(dep_col, '')}",
                    r.get("__comp_pfx", ""),
                ), axis=1,
            )

        # 5. Code Section
        if sec_col and sec_col in self.df.columns:
            code_dir = self._code_col("Directorate")
            code_div = self._code_col("Division")
            code_dep = self._code_col("Department")
            self.df[self._code_col("Section")] = self.df.apply(
                lambda r: gen_sec.get_code(
                    f"{r.get('__comp_pfx','')}_{r.get(code_dir,'')}_{r.get(code_div,'')}_{r.get(code_dep,'')}_{r.get(sec_col,'')}",
                    r.get("__comp_pfx", ""),
                ), axis=1,
            )

        # 6. Code Location
        if loc_col and loc_col in self.df.columns:
            cust_loc = self.cfg.location_codes if self.cfg.code_mode == "custom" else None
            self.df[self._code_col("Location")] = self.df[loc_col].apply(
                lambda v: generate_location_code(v, cust_loc)
            )

        # 7. Code Level
        if lev_col and lev_col in self.df.columns:
            level_map = self.cfg.level_order
            dc = self.cfg.digit_count
            self.df[self._code_col("Level")] = self.df.apply(
                lambda r: self._level_code(r, lev_col, level_map, dc), axis=1,
            )

        # 8. Code Job Title
        if jt_col and jt_col in self.df.columns:
            code_lev = self._code_col("Level")
            self.df[self._code_col("Job Title")] = self.df.apply(
                lambda r: gen_jt.get_code(
                    f"{r.get(code_lev, '')}_{r.get(jt_col, '')}",
                    r.get("__comp_pfx", ""),
                ), axis=1,
            )

        # 9. Code Position
        if pos_col and pos_col in self.df.columns:
            code_jt = self._code_col("Job Title")
            code_sec = self._code_col("Section")
            code_loc = self._code_col("Location")
            self.df[self._code_col("Position")] = self.df.apply(
                lambda r: gen_pos.get_code(
                    f"{r.get(code_jt, '')}_{r.get(code_sec, '')}_{r.get(code_loc, '')}_{r.get(pos_col, '')}",
                    r.get("__comp_pfx", ""),
                ), axis=1,
            )

        # Drop temp column
        self.df.drop(columns=["__comp_pfx"], inplace=True, errors="ignore")

    def _level_code(self, row, lev_col, level_map, dc):
        val = row.get(lev_col, "")
        if pd.isna(val) or val == "":
            return ""
        order = level_map.get(str(val).strip().upper(), 99)
        pfx = row.get("__comp_pfx", "")
        if self.use_prefix and pfx:
            return f"{pfx}{order:0{dc}d}"
        return f"{order:0{dc + 1}d}"

    def _arrange_columns(self) -> pd.DataFrame:
        target_fields = [
            "Company", "Directorate", "Division", "Department",
            "Section", "Location", "Level", "Job Title", "Position",
        ]

        original_cols = [c for c in self.df.columns if not c.startswith("Code ")]
        final = []
        for col in original_cols:
            # If this col is a mapped target, insert Code col before it
            for tf in target_fields:
                mapped_col = self._c(tf)
                code_col = self._code_col(tf)
                if mapped_col == col and code_col in self.df.columns and code_col not in final:
                    final.append(code_col)
            final.append(col)

        # Append any remaining code columns
        for col in self.df.columns:
            if col not in final:
                final.append(col)

        return self.df[[c for c in final if c in self.df.columns]]


# ──────────────────── Excel Builder ─────────────────────

def build_excel_output(
    original_bytes: bytes,
    sheet_name: str,
    df_result: pd.DataFrame,
    header_row: int = 2,
    data_start_row: int = 3,
) -> bytes:
    """
    Build the final Excel with 3 sheets:
      1. Original (untouched — 100% preserved with all formatting)
      2. Original (EDIT) — copy of original with TRIM applied to string cells
      3. HASIL — mapping results with formatting
    Returns bytes of the .xlsx file.
    """
    # Load the original workbook preserving everything
    buf = BytesIO(original_bytes)
    wb = load_workbook(buf)

    edit_sheet_name = f"{sheet_name} (EDIT)"
    hasil_sheet_name = "HASIL"

    # Remove old EDIT/HASIL sheets if they exist (re-run safe)
    for name in [edit_sheet_name, hasil_sheet_name]:
        if name in wb.sheetnames:
            del wb[name]

    # --- Sheet 1: ORIGINAL stays UNTOUCHED (already in wb) ---

    # --- Sheet 2: EDIT — copy original sheet, then apply TRIM ---
    ws_orig = wb[sheet_name]
    ws_edit = wb.copy_worksheet(ws_orig)
    ws_edit.title = edit_sheet_name

    # Remove AutoFilter from EDIT sheet so all data is visible
    # (original may be filtered, causing copied sheet to show incomplete data)
    ws_edit.auto_filter.ref = None

    # Unhide all rows in EDIT sheet (filters hide rows)
    for row_idx in range(1, ws_edit.max_row + 1):
        rd = ws_edit.row_dimensions.get(row_idx)
        if rd and rd.hidden:
            rd.hidden = False

    # Apply TRIM to all string cells in the EDIT sheet (data area only)
    for row in ws_edit.iter_rows(
        min_row=data_start_row,
        max_row=ws_edit.max_row,
        min_col=1,
        max_col=ws_edit.max_column,
    ):
        for cell in row:
            if cell.value is not None and isinstance(cell.value, str):
                cell.value = clean_text(cell.value)

    # --- Sheet 3: HASIL — write mapping results ---
    # Format matches the original: row 1 = original row 1, header at header_row, data at data_start_row
    ws_hasil = wb.create_sheet(hasil_sheet_name)

    # Copy rows before header (row 1, etc.) from original to HASIL
    for r in range(1, header_row):
        for cell_orig in ws_orig[r]:
            new_cell = ws_hasil.cell(
                row=r,
                column=cell_orig.column,
                value=cell_orig.value,
            )
            # Copy styling from original row 1
            if cell_orig.has_style:
                new_cell.font = copy(cell_orig.font)
                new_cell.fill = copy(cell_orig.fill)
                new_cell.alignment = copy(cell_orig.alignment)
                new_cell.border = copy(cell_orig.border)
                new_cell.number_format = cell_orig.number_format

    # Copy row dimensions for pre-header rows
    for r in range(1, header_row):
        rd = ws_orig.row_dimensions.get(r)
        if rd:
            ws_hasil.row_dimensions[r].height = rd.height
            ws_hasil.row_dimensions[r].hidden = rd.hidden

    # Collect header styles from the original sheet's header row
    orig_header_styles = {}
    for cell in ws_orig[header_row]:
        if cell.value is not None:
            col_name = str(cell.value).strip()
            orig_header_styles[col_name] = {
                "fill": copy(cell.fill) if cell.has_style else None,
                "font": copy(cell.font) if cell.has_style else None,
                "alignment": copy(cell.alignment) if cell.has_style else None,
                "border": copy(cell.border) if cell.has_style else None,
                "number_format": cell.number_format,
            }

    # Default fills for Code columns (not present in original)
    yellow_fill = PatternFill(start_color="FFFF00", end_color="FFFF00", fill_type="solid")
    green_fill = PatternFill(start_color="92D050", end_color="92D050", fill_type="solid")
    bold_font = Font(bold=True)
    center_align = Alignment(horizontal="center")

    # Write HASIL headers at header_row (e.g., row 2)
    for ci, col_name in enumerate(df_result.columns, 1):
        cell = ws_hasil.cell(row=header_row, column=ci, value=col_name)
        col_name_str = str(col_name).strip()

        if col_name_str in orig_header_styles and orig_header_styles[col_name_str].get("fill"):
            # Use original header style for columns that exist in the original
            style = orig_header_styles[col_name_str]
            if style["fill"]:
                cell.fill = style["fill"]
            if style["font"]:
                cell.font = style["font"]
            if style["alignment"]:
                cell.alignment = style["alignment"]
            if style["border"]:
                cell.border = style["border"]
            if style["number_format"]:
                cell.number_format = style["number_format"]
        else:
            # New Code columns get green fill
            cell.font = bold_font
            cell.alignment = center_align
            col_lower = col_name_str.lower()
            if col_lower in ('nopegawai', 'no pegawai', 'nama', 'name'):
                cell.fill = yellow_fill
            else:
                cell.fill = green_fill

    # Write HASIL data starting at data_start_row (e.g., row 3)
    for ri, row_data in enumerate(df_result.itertuples(index=False), data_start_row):
        for ci, val in enumerate(row_data, 1):
            ws_hasil.cell(row=ri, column=ci, value=val)

    # Auto-fit column widths for HASIL only (don't touch original or EDIT)
    for col_cells in ws_hasil.columns:
        max_len = 0
        col_letter = col_cells[0].column_letter
        for cell in col_cells:
            if cell.value:
                max_len = max(max_len, len(str(cell.value)))
        ws_hasil.column_dimensions[col_letter].width = min(max_len + 3, 50)

    out = BytesIO()
    wb.save(out)
    return out.getvalue()

