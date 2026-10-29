"""Reproducible fictional Indian retail data, never real customer records."""
from datetime import datetime, timedelta, timezone
import numpy as np
import pandas as pd

INDIA = timezone(timedelta(hours=5, minutes=30))
MALE_NAMES = "Aarav Vivaan Aditya Arjun Rohan Ishaan Kabir Kunal Rahul Siddharth Akshay Varun Nikhil Amit Pranav Saurabh Ankit Harsh Yash Dev Dhruv Manish Vikram Abhishek Sachin Sandeep Rohit Karthik Arvind Ashwin Deepak Gaurav Mohit Pratik Nitin Sanjay Vishal Akash Anand Rakesh Suraj Naveen Rajesh Suresh Vivek Tarun Ajay Imran Ayaan Farhan".split()
FEMALE_NAMES = "Aadhya Ananya Diya Isha Kavya Meera Nisha Priya Riya Saanvi Sneha Tanvi Aditi Anjali Divya Pooja Neha Shreya Swati Kritika Ishita Pallavi Radhika Ritika Sakshi Shruti Simran Sonal Vaishnavi Ankita Aparna Bhavna Deepika Gayatri Harini Janani Keerthi Lakshmi Madhuri Navya Parvati Revathi Sandhya Trisha Vidya Yamini Zoya Sana Fatima Aisha".split()
SURNAMES = "Sharma Verma Gupta Singh Kumar Mehta Shah Patel Desai Joshi Rao Reddy Iyer Nair Menon Pillai Kapoor Malhotra Khanna Bhatia Chopra Arora Sethi Bansal Agarwal Jain Saxena Choudhary Mishra Pandey Tiwari Dubey Kulkarni Patil Deshmukh Pawar Ghosh Roy Das Bose Banerjee Sen Dutta Mukherjee Chatterjee Sinha Prasad Yadav Shetty Hegde Fernandes Dsouza Khan Siddiqui Ansari Ali Bhat Mirza Naidu Narayanan".split()
LOCATIONS = [("Mumbai", "Maharashtra", "400001"), ("Pune", "Maharashtra", "411001"), ("Bengaluru", "Karnataka", "560001"), ("Chennai", "Tamil Nadu", "600001"), ("Kochi", "Kerala", "682001"), ("New Delhi", "Delhi", "110001"), ("Hyderabad", "Telangana", "500001"), ("Kolkata", "West Bengal", "700001"), ("Ahmedabad", "Gujarat", "380001"), ("Jaipur", "Rajasthan", "302001"), ("Lucknow", "Uttar Pradesh", "226001"), ("Indore", "Madhya Pradesh", "452001"), ("Chandigarh", "Chandigarh", "160017"), ("Coimbatore", "Tamil Nadu", "641001"), ("Nagpur", "Maharashtra", "440001"), ("Thiruvananthapuram", "Kerala", "695001")]

# Marketplace-style titles and plausible fictional prices; not a live price catalog.
CATALOG = [
    ("Electronics", "boAt Rockerz 450 Bluetooth On-Ear Headphones, Mic and 15-Hour Playback", 1499),
    ("Electronics", "Samsung Galaxy A35 5G Smartphone, 8GB RAM, 128GB Storage", 27999),
    ("Electronics", "Logitech M331 Silent Plus Wireless Mouse with USB Receiver", 1099),
    ("Electronics", "Sony WH-CH520 Wireless Bluetooth Headphones, 50-Hour Battery", 4490),
    ("Electronics", "Anker Nano 20W USB-C Fast Charger with Foldable Plug", 1299),
    ("Electronics", "SanDisk Ultra 128GB microSDXC Memory Card, Class 10", 899),
    ("Clothing", "Allen Solly Men's Regular Fit Cotton Casual Shirt, Full Sleeve", 1599),
    ("Clothing", "BIBA Women's Printed Cotton Kurta with Straight Pants", 2499),
    ("Clothing", "Jockey Unisex Cotton Crew-Neck T-Shirt, Everyday Essentials", 699),
    ("Clothing", "Levi's 511 Slim Fit Stretch Denim Jeans, Mid Rise", 2999),
    ("Footwear", "Puma Unisex Running Shoes with SoftFoam Cushioning", 3299),
    ("Footwear", "Adidas Runfalcon Lightweight Running Shoes, Breathable Mesh", 3999),
    ("Footwear", "Bata Everyday Comfort Slip-On Casual Loafers", 1499),
    ("Footwear", "Sparx Sports Walking Shoes with Flexible EVA Sole", 1299),
    ("Accessories", "American Tourister 32L Laptop Backpack, Water Resistant", 1899),
    ("Accessories", "Wildcraft 45L Weekend Travel Duffle Bag with Shoulder Strap", 2199),
    ("Accessories", "Fastrack Analog Watch with Silicone Strap and Round Dial", 1799),
    ("Accessories", "Lavie Everyday Tote Handbag with Zip Closure and Inner Pockets", 1599),
    ("Home", "Philips 9W LED Desk Lamp with Adjustable Neck, Warm White", 1699),
    ("Home", "Bombay Dyeing 100% Cotton Double Bedsheet with Two Pillow Covers", 1299),
    ("Home", "Solimo Blackout Window Curtains, 5 Feet, Pack of 2", 999),
    ("Home", "Cello Modular Storage Containers, Airtight, Set of 6", 899),
    ("Kitchen", "Prestige 3-Litre Stainless Steel Pressure Cooker, Induction Base", 2499),
    ("Kitchen", "Milton Thermosteel 1-Litre Vacuum Insulated Water Bottle", 1099),
    ("Kitchen", "Borosil French Press Coffee Maker, 600ml, Heat Resistant Glass", 1399),
    ("Kitchen", "Pigeon Non-Stick Cookware Set, Fry Pan, Tawa and Kadai", 1899),
    ("Fitness", "Boldfit Anti-Skid Yoga Mat, 6mm Thick with Carry Strap", 799),
    ("Fitness", "Nivia Storm Football, Size 5, Rubber Moulded", 699),
    ("Fitness", "Decathlon Resistance Training Bands, Set of 3 Strengths", 999),
    ("Fitness", "Cosco Adjustable Skipping Rope with Foam Grip Handles", 299),
    ("Stationery", "Classmate A4 Single-Line Notebook, 180 Pages, Pack of 6", 449),
    ("Stationery", "Parker Vector Standard Roller Ball Pen with Gift Box", 599),
    ("Stationery", "Faber-Castell Colour Pencils, 24 Shades in Metal Tin", 549),
    ("Stationery", "Paperkraft Premium Ruled Journal, A5 Hardcover, 192 Pages", 399),
]


def india_today():
    return datetime.now(INDIA).date()


def generate_indian_retail(size=10000, seed=42, end_date=None, messy=True):
    if not 100 <= size <= 100000:
        raise ValueError("Generate between 100 and 100,000 rows")
    end = pd.Timestamp(end_date or india_today()).normalize()
    if pd.isna(end) or end.date() > india_today():
        raise ValueError("End date must be a valid date no later than today in India")
    rng = np.random.default_rng(seed)
    customer_count = max(60, size // 12)
    gender = rng.choice(["Male", "Female"], customer_count)
    names = [f"{rng.choice(MALE_NAMES if value == 'Male' else FEMALE_NAMES)} {rng.choice(SURNAMES)}" for value in gender]
    activity = rng.lognormal(0, .55, customer_count)
    stopped = rng.random(customer_count) < .27
    customer = rng.choice(customer_count, size=size, p=activity / activity.sum())
    start = end - pd.Timedelta(days=729)
    days = np.arange(730)
    weights = (.65 + .5 * days / 729) * (1 + .2 * np.sin(days / 30)) * np.where((start.day_of_week + days) % 7 >= 5, 1.25, 1)
    day = rng.choice(days, size=size, p=weights / weights.sum())
    stop_day = rng.integers(420, 600, customer_count)
    early_days = rng.integers(0, stop_day[customer] + 1)
    day = np.where(stopped[customer], early_days, day)
    # Guarantee recent valid purchases, without assigning late purchases to stopped shoppers.
    recent_rows = np.flatnonzero(~stopped[customer])[:max(20, size // 500)]
    day[recent_rows] = 729 - np.arange(len(recent_rows)) % 7
    category_indices = {category: [i for i, row in enumerate(CATALOG) if row[0] == category] for category in sorted({row[0] for row in CATALOG})}
    favorites = rng.choice(list(category_indices), customer_count)
    product = rng.integers(0, len(CATALOG), size)
    preferred = rng.random(size) < .65
    for category, indices in category_indices.items():
        mask = preferred & (favorites[customer] == category)
        product[mask] = rng.choice(indices, int(mask.sum()))
    variant = rng.integers(0, 3, size)
    variant_names = ["Classic Edition", "Everyday Edition", "Premium Edition"]
    titles = [f"{CATALOG[p][1]} | {variant_names[v]}" for p, v in zip(product, variant)]
    prices = np.array([CATALOG[p][2] for p in product]) + variant * 100
    quantity = rng.choice([1, 2, 3, 4], size, p=[.76, .18, .04, .02])
    location = rng.integers(0, len(LOCATIONS), customer_count)[customer]
    payment = rng.choice(["UPI", "Credit Card", "Debit Card", "Cash on Delivery", "Net Banking"], size, p=[.43, .23, .15, .13, .06])
    cancellation = .045 + .10 * (payment == "Cash on Delivery") + .025 * (prices > 10000)
    chance = rng.random(size)
    status = np.where(chance < cancellation, "Cancelled", np.where(chance < cancellation + .035, "Returned", "Completed"))
    status[recent_rows] = "Completed"
    dates = (start + pd.to_timedelta(day, unit="D")).strftime("%Y-%m-%d")
    frame = pd.DataFrame({
        "order_id": [f"RP-{value.replace('-', '')}-{i:07}" for i, value in enumerate(dates)],
        "customer_id": [f"C-{i:06}" for i in customer], "customer_name": [names[i] for i in customer],
        "gender": gender[customer], "email": [f"{names[i].lower().replace(' ', '.')}.{i}@example.test" for i in customer],
        "product_id": [f"SKU-{p:03}-{v+1}" for p, v in zip(product, variant)], "product_name": titles,
        "brand": [CATALOG[p][1].split()[0] for p in product], "category": [CATALOG[p][0] for p in product],
        "price": prices.astype(str), "quantity": quantity.astype(str), "order_date": dates,
        "store_id": [f"IN-{i+1:03}" for i in location], "store_name": [f"RetailPlus {LOCATIONS[i][0]}" for i in location],
        "country": "India", "city": [LOCATIONS[i][0] for i in location], "state": [LOCATIONS[i][1] for i in location],
        "postal_code": [LOCATIONS[i][2] for i in location], "payment_method": payment, "status": status, "currency": "INR",
        "avatar_seed": [f"retailplus-{i}-{names[i]}" for i in customer],
    }, dtype="string")
    if messy:
        protected = set(recent_rows)
        candidates = np.array([i for i in range(size - size // 50) if i not in protected])
        for column in ("customer_name", "product_name", "category", "city", "price", "quantity"):
            frame.loc[rng.choice(candidates, size // 200, replace=False), column] = ""
        lower = rng.choice(candidates, size // 30, replace=False)
        frame.loc[lower, "product_name"] = frame.loc[lower, "product_name"].str.lower()
        invalid = rng.choice(candidates, size // 100, replace=False)
        frame.loc[invalid[::3], "price"] = "-10"
        frame.loc[invalid[1::3], "quantity"] = "0"
        frame.loc[invalid[2::3], "order_date"] = (end + pd.Timedelta(days=30)).strftime("%Y-%m-%d")
        count = size // 50
        # Avoid duplicating today's showcase purchases, while keeping exact 2% duplicates.
        frame.iloc[-count:] = frame.iloc[candidates[:count]].to_numpy()
    return frame
