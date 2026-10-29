from dataclasses import dataclass
from io import StringIO
import csv
import re
from time import perf_counter

import pandas as pd
import pandera.pandas as pa
from rapidfuzz import fuzz, process
from .retail import guess_mapping, eligibility, quality, clean_retail


MAX_CSV_BYTES = 50 * 1024 * 1024
MAX_CSV_ROWS = 100_000
MAX_CSV_COLUMNS = 100
EMPTY_VALUES = {"", "na", "n/a", "null", "none", "unknown", "-"}
FIELD_ALIASES = {
    "customer_name": {"customer name", "client name", "buyer name"},
    "email": {"email", "email address", "e mail"},
    "phone": {"phone", "phone number", "mobile", "mobile number"},
    "product_name": {"product name", "item name", "product title"},
    "category": {"category", "product category", "item category"},
    "price": {"price", "unit price", "selling price"},
    "order_id": {"order id", "order number", "invoice number"},
    "date": {"date", "order date", "transaction date"},
}


@dataclass
class CsvResult:
    frame: pd.DataFrame
    summary: dict[str, object]
    changes: list[dict[str, object]]


def normalize_field_name(name: str) -> str:
    if name.strip() == "_imputed_fields":
        return "_imputed_fields"
    normalized = re.sub(r"[^a-z0-9]+", "_", name.strip().lower()).strip("_")
    return normalized or "column"


def match_fields(columns: list[str]) -> tuple[list[str], list[dict[str, object]]]:
    canonical = {normalize_field_name(alias): field for field, aliases in FIELD_ALIASES.items() for alias in aliases}
    renamed = []
    matches = []
    used = set()
    for original in columns:
        normalized = normalize_field_name(original)
        field = canonical.get(normalized, normalized)
        if field in used:
            raise ValueError(f"Column names become duplicates after normalization: {original}")
        used.add(field)
        renamed.append(field)
        if field != original:
            matches.append({"source": original, "target": field, "confidence": 100, "applied": True})
        elif normalized not in FIELD_ALIASES:
            suggestion = process.extractOne(normalized, list(FIELD_ALIASES), scorer=fuzz.ratio)
            if suggestion and suggestion[1] >= 70:
                matches.append({"source": original, "target": suggestion[0], "confidence": round(suggestion[1]), "applied": False})
    return renamed, matches


def clean_cells(frame: pd.DataFrame) -> pd.DataFrame:
    cleaned = frame.map(lambda value: re.sub(r"\s+", " ", value).strip() if isinstance(value, str) else value)
    return cleaned.map(lambda value: pd.NA if isinstance(value, str) and value.lower() in EMPTY_VALUES else value)


def understand_dataset(frame: pd.DataFrame) -> dict[str, object]:
    columns = set(frame.columns)
    if "order_id" in columns:
        dataset_type = "transactions"
        suggested_fields = ["order_id", "date", "price"]
    elif "product_name" in columns:
        dataset_type = "products"
        suggested_fields = ["product_name", "category", "price"]
    elif "customer_name" in columns or "email" in columns:
        dataset_type = "customers"
        suggested_fields = ["customer_name", "email", "phone"]
    elif "department" in columns or "employee_name" in columns:
        dataset_type = "employees"
        suggested_fields = ["employee_name", "department", "role"]
    else:
        dataset_type = "general"
        suggested_fields = []
    field_types = {}
    for name in frame.columns:
        values = frame[name].dropna().astype(str).str.strip()
        if name in {"email"}:
            field_types[name] = "email text"
        elif any(word in name for word in ("id", "code", "sku", "postal", "zip")):
            field_types[name] = "identifier text"
        elif len(values) and values.str.fullmatch(r"[+-]?\d+(?:\.\d+)?").mean() >= 0.9:
            field_types[name] = "numeric-looking text"
        elif len(values) and values.str.fullmatch(r"\d{4}-\d{2}-\d{2}").mean() >= 0.9:
            field_types[name] = "date-looking text"
        else:
            field_types[name] = "text"
    return {
        "dataset_type": dataset_type,
        "likely_field_types": field_types,
        "suggested_missing_fields": [name for name in suggested_fields if name not in columns],
        "type_conversion_applied": False,
    }


def find_possible_duplicates(frame: pd.DataFrame) -> list[dict[str, object]]:
    text_columns = [column for column in ("customer_name", "product_name", "email") if column in frame]
    if not text_columns:
        return []
    column = text_columns[0]
    candidates = frame[[column]].dropna().reset_index()
    if len(candidates) > 500:
        return []
    found = []
    for position, row in candidates.iterrows():
        for other_position in range(position + 1, len(candidates)):
            other = candidates.iloc[other_position]
            similarity = fuzz.ratio(str(row[column]).casefold(), str(other[column]).casefold())
            if 80 <= similarity < 100:
                found.append({"row_a": int(row["index"]) + 2, "row_b": int(other["index"]) + 2, "field": column, "similarity": round(similarity)})
                if len(found) >= 20:
                    return found
    return found


def organize_csv(content: bytes, mapping_override=None) -> CsvResult:
    started = perf_counter()
    if not content or len(content) > MAX_CSV_BYTES:
        raise ValueError("CSV must be between 1 byte and 50 MB")
    if content.startswith((b"\xff\xfe", b"\xfe\xff")):
        encoding = "utf-16"
    else:
        encoding = "utf-8-sig"
    try:
        text = content.decode(encoding)
    except UnicodeError:
        encoding = "windows-1252"
        try:
            text = content.decode(encoding)
        except UnicodeError as error:
            raise ValueError("Could not decode this CSV. Save it as UTF-8 and try again") from error
    if "\x00" in text or any(ord(character) < 32 and character not in "\r\n\t" for character in text[:8192]):
        raise ValueError("This file does not look like a text CSV. Export it as CSV and try again")
    try:
        delimiter = csv.Sniffer().sniff(text[:8192], delimiters=",;\t|").delimiter
    except csv.Error:
        delimiter = ","
    try:
        frame = pd.read_csv(StringIO(text), sep=delimiter, dtype="string", keep_default_na=False, nrows=MAX_CSV_ROWS + 1, on_bad_lines="error")
    except (pd.errors.ParserError, pd.errors.EmptyDataError) as error:
        raise ValueError("Some CSV rows have a different number of fields. Check the separator and quoted values, then export the file again") from error
    if frame.empty:
        raise ValueError("CSV must contain at least one data row")
    if len(frame) > MAX_CSV_ROWS or len(frame.columns) > MAX_CSV_COLUMNS:
        raise ValueError("CSV exceeds the 100,000 row or 100 column limit")
    if len(set(frame.columns)) != len(frame.columns):
        raise ValueError("CSV contains duplicate column names")
    names, matches = match_fields(frame.columns.tolist())
    changes = [
        {"data_row": 0, "field": match["target"], "original_value": match["source"], "new_value": match["target"], "action": "rename_field", "decision": "automatic"}
        for match in matches if match["applied"]
    ]
    frame.columns = names
    original_frame = frame.copy()
    frame = clean_cells(frame)
    mapping = mapping_override if mapping_override is not None else guess_mapping(frame.columns)
    before_quality = quality(original_frame, mapping)
    understanding = understand_dataset(frame)
    for name in names:
        for index, (original_value, new_value) in enumerate(zip(original_frame[name], frame[name]), start=1):
            if pd.isna(new_value):
                if not pd.isna(original_value):
                    changes.append({"data_row": index, "field": name, "original_value": str(original_value), "new_value": "", "action": "mark_missing", "decision": "automatic"})
            elif original_value != new_value:
                changes.append({"data_row": index, "field": name, "original_value": str(original_value), "new_value": str(new_value), "action": "normalize_whitespace", "decision": "automatic"})
    strategies = {}
    invalid_report = {"count": 0, "rows": [], "truncated": False}
    if eligibility(mapping)["eligible"]:
        frame, retail_changes, strategies, invalid_report = clean_retail(frame, mapping)
        changes.extend(retail_changes)
    schema = pa.DataFrameSchema({name: pa.Column(pa.String, nullable=True, required=True) for name in frame.columns}, strict=True)
    try:
        schema.validate(frame)
    except pa.errors.SchemaError as error:
        raise ValueError("CSV columns failed validation") from error
    original_count = len(frame)
    missing = {name: int(frame[name].isna().sum()) for name in names if frame[name].isna().any()}
    possible_duplicates = find_possible_duplicates(frame)
    duplicate_mask = frame.duplicated(keep="first")
    for index in frame.index[duplicate_mask]:
        changes.append({"data_row": int(index) + 1, "field": "*", "original_value": str(original_frame.loc[index].to_dict()), "new_value": "", "action": "remove_exact_duplicate", "decision": "automatic"})
    frame = frame.drop_duplicates(ignore_index=True)
    summary = {
        "original_rows": original_count,
        "organized_rows": len(frame),
        "exact_duplicates_removed": original_count - len(frame),
        "missing_values": missing,
        "field_matches": matches,
        "possible_duplicates": possible_duplicates,
        "columns": frame.columns.tolist(),
        "mapping": mapping,
        "eligibility": eligibility(mapping),
        "quality_before": before_quality,
        "quality_after": quality(frame, mapping),
        "invalid_transactions": invalid_report,
        "missing_strategies": strategies,
        "fixes": {"filled": sum(c["action"].startswith(("fill_", "impute_")) for c in changes), "casing": sum(c["action"] == "normalize_casing" for c in changes), "invalid": invalid_report["count"]},
        "processing_seconds": round(perf_counter() - started, 3),
        "category_status": "existing" if "category" in frame else "not_generated",
        "source_format": {"encoding": encoding, "delimiter": "tab" if delimiter == "\t" else delimiter},
        "understanding": understanding,
        "change_count": len(changes),
        "change_preview": changes[:20],
        "preview": frame.head(8).fillna("").to_dict(orient="records"),
    }
    return CsvResult(frame=frame, summary=summary, changes=changes)
