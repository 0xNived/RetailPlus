from datetime import timedelta
import unittest

import pandas as pd

from app.retail_demo import generate_indian_retail, india_today
from app.retail import analytics, guess_mapping, FEATURES


class IndianDemoTests(unittest.TestCase):
    def test_clean_data_has_consistent_profiles_and_current_orders(self):
        today = india_today().isoformat()
        frame = generate_indian_retail(1000, 42, today, False)
        pd.testing.assert_frame_equal(frame, generate_indian_retail(1000, 42, today, False))
        self.assertEqual(len(frame), 1000)
        self.assertEqual(frame.order_id.nunique(), 1000)
        self.assertEqual(set(frame.gender), {"Male", "Female"})
        self.assertFalse(frame.customer_name.str.startswith("Customer ").any())
        self.assertTrue(frame.email.str.endswith("@example.test").all())
        self.assertTrue(frame.product_name.str.len().ge(45).all())
        self.assertTrue(frame.postal_code.str.fullmatch(r"\d{6}").all())
        self.assertEqual(frame.order_date.max(), today)
        self.assertGreater(((frame.order_date == today) & (frame.status == "Completed")).sum(), 0)
        for field in ("customer_name", "gender", "email", "avatar_seed", "city", "state", "postal_code"):
            self.assertEqual(frame.groupby("customer_id")[field].nunique().max(), 1, field)
        result = analytics(frame, guess_mapping(frame.columns))
        self.assertEqual(result["currency"], "INR")
        self.assertEqual(result["kpis"]["excluded_rows"], 0)
        self.assertNotIn("gender", FEATURES)

    def test_future_dates_and_invalid_sizes_rejected(self):
        for size, end in ((99, None), (100001, None), (100, india_today() + timedelta(days=1))):
            with self.assertRaises(ValueError):
                generate_indian_retail(size, end_date=end)

    def test_currency_mapping_rejects_mixed_totals(self):
        frame = pd.DataFrame({"order_date": ["2026-01-01"] * 2, "price": ["10", "20"], "currency": ["INR", "USD"]})
        with self.assertRaisesRegex(ValueError, "mixes currencies"):
            analytics(frame, guess_mapping(frame.columns))

