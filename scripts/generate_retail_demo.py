"""python scripts/generate_retail_demo.py --rows 50000 --end-date 2026-10-29"""
import argparse
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "api-service"))
from app.retail_demo import generate_indian_retail, india_today


def main():
    parser = argparse.ArgumentParser(description="Generate fictional Indian retail CSV data. Clean by default; add --messy to demonstrate cleaning.")
    parser.add_argument("--rows", type=int, default=50000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--end-date", default=india_today().isoformat())
    parser.add_argument("--messy", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    path = args.output or ROOT / "data" / "raw" / f"indian-retail-{args.end_date}-{args.rows}.csv"
    if path.exists():
        parser.error(f"Output already exists: {path}. Choose another --output; sources are never overwritten.")
    try:
        frame = generate_indian_retail(args.rows, args.seed, args.end_date, args.messy)
    except ValueError as error:
        parser.error(str(error))
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False)
    print(f"Saved {len(frame):,} fictional INR transactions through {args.end_date}: {path}")
    print("Gender is explicitly generated; profiles are placeholders, not real people. Product prices are synthetic.")


if __name__ == "__main__":
    main()
