import unittest
import pandas as pd
from app.product_planning import product_plan
from app.retail import guess_mapping


def fixture(values, second=None):
    rows = []
    for index, units in enumerate(values):
        rows.append({"order_date": str(pd.Period("2025-01", "M") + index) + "-15", "product_id": "SKU-001", "product_name": "Original name" if index < 5 else "Updated name", "category": "Electronics", "price": "10", "quantity": str(units), "status": "Completed", "order_id": f"A-{index}"})
    if second:
        for index, units in enumerate(second):
            rows.append({"order_date": str(pd.Period("2025-01", "M") + index) + "-15", "product_id": "SKU-002", "product_name": "Second product", "category": "Home", "price": "5", "quantity": str(units), "status": "Completed", "order_id": f"B-{index}"})
    return pd.DataFrame(rows, dtype="string")


class ProductPlanningTests(unittest.TestCase):
    def test_method_selection_requires_three_checks_and_no_product_cap(self):
        frame = fixture([1, 10, 20, 30, 40, 50, 60, 70, 80, 1])
        product = product_plan(frame, guess_mapping(frame.columns))["products"][0]
        self.assertEqual(product["method"], "Last complete month")
        self.assertEqual(product["forecast_units"], 80)
        self.assertEqual(product["evaluation"][0]["periods"], 4)
        many = pd.concat([frame.assign(product_id=f"SKU-{i:04}") for i in range(205)], ignore_index=True)
        self.assertEqual(len(product_plan(many, guess_mapping(many.columns))["products"]), 205)

    def test_boundaries_sku_identity_revenue_and_two_month_horizon(self):
        frame = fixture([999, 10, 10, 10, 10, 10, 10, 9999])
        result = product_plan(frame, guess_mapping(frame.columns))
        self.assertEqual(result["target_month"], "2025-09")
        self.assertEqual(len(result["products"]), 1)  # Changed title cannot split SKU.
        product = result["products"][0]
        self.assertEqual(product["product"], "Updated name")
        self.assertEqual(product["forecast_units"], 10)
        self.assertEqual(product["revenue_plan"], 100)
        self.assertEqual(product["average_selling_price"], 10)
        self.assertEqual([r["month"] for r in product["history"]], ["2025-02", "2025-03", "2025-04", "2025-05", "2025-06", "2025-07"])
        for check in product["evaluation"]:
            self.assertEqual(check["periods"], 2)
            self.assertEqual(check["mae_units"], 0)
            self.assertEqual(check["wape_percent"], 0)
        self.assertEqual(product["abc_class"], "A")

    def test_backtest_excludes_hidden_month_and_target(self):
        frame = fixture([1, 10, 20, 30, 900, 40, 1])
        product = product_plan(frame, guess_mapping(frame.columns))["products"][0]
        checks = {e["method"]: e for e in product["evaluation"]}
        # Interior Feb-Jun: target Jun 40. Its hidden prior month May=900 is excluded.
        self.assertEqual(checks["moving_average"]["mae_units"], 20)
        self.assertEqual(checks["moving_average"]["bias_units"], -20)
        self.assertEqual(checks["last_month"]["mae_units"], 10)
        self.assertEqual(checks["moving_average"]["wape_percent"], 50)
        # Only one check: don't choose the winner from an inadequate evaluation.
        self.assertEqual(product["method"], "3-month moving average")

    def test_order_rates_exclude_invalid_and_do_not_forecast_cancelled_units(self):
        frame = fixture([1, 10, 20, 30, 100, 1])
        extra = pd.DataFrame([{"order_date": "2025-05-15", "product_id": "SKU-001", "product_name": "Updated name", "category": "Electronics", "price": "10", "quantity": "500", "status": status, "order_id": f"extra-{status}"} for status in ("Cancelled", "Returned")], dtype="string")
        frame = pd.concat([frame, extra, extra.iloc[:1]], ignore_index=True)
        product = product_plan(frame, guess_mapping(frame.columns))["products"][0]
        self.assertEqual(product["forecast_units"], 50)
        self.assertEqual(product["cancellation_rate"], 20)  # 3 completed + cancel + return.
        self.assertEqual(product["return_rate"], 20)

    def test_insufficient_product_history_is_not_invented(self):
        frame = fixture([1, 10, 10, 10, 10, 1])
        new = frame.iloc[-1:].copy()
        new["product_id"] = "NEW"
        frame = pd.concat([frame, new], ignore_index=True)
        result = product_plan(frame, guess_mapping(frame.columns))
        new = next(p for p in result["products"] if p["product_id"] == "NEW")
        self.assertFalse(new["eligible"])
        self.assertIsNone(new["forecast_units"])
        self.assertEqual(result["summary"]["eligible_products"], 1)

    def test_zero_sale_months_and_zero_wape_denominator(self):
        frame = fixture([1, 10, 10, 10, 10, 10, 10, 1])
        frame.loc[frame.order_date.isin(["2025-06-15", "2025-07-15"]), "status"] = "Cancelled"
        product = product_plan(frame, guess_mapping(frame.columns))["products"][0]
        self.assertEqual(product["history"][-1]["units"], 0)
        for check in product["evaluation"]:
            self.assertIsNone(check["wape_percent"])
        short = fixture([1, 10, 1])
        self.assertFalse(product_plan(short, guess_mapping(short.columns))["available"])

