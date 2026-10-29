import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  Layers3,
  LockKeyhole,
  Search,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import Brand from "./Brand";
import ProductIcon from "./retail/ProductIcon";
import { formatNumber, formatMoney } from "./retailApi";
import { SalesChart } from "./retail/components";
import "./landing.css";

// This public tour is calculated from a small illustrative fixture, never account data.
const sampleSales = [
  820, 1040, 920, 1350, 1190, 1420, 1280, 1640, 1510, 1840, 1720, 2100,
];
const sampleTrend = sampleSales.map((revenue, index) => ({
  order_date: `2025-01-${String(index + 1).padStart(2, "0")}`,
  revenue,
  orders: 8 + index,
}));
const sampleProducts = [
  {
    name: "Wireless headphones",
    category: "Electronics",
    price: 149,
    units: 24,
  },
  { name: "Everyday cotton shirt", category: "Clothing", price: 39, units: 38 },
  { name: "Travel backpack", category: "Accessories", price: 79, units: 19 },
  { name: "Ceramic coffee press", category: "Kitchen", price: 49, units: 16 },
];

export default function LandingPage({ onLogin }: { onLogin: () => void }) {
  const [preview, setPreview] = useState("Sales overview");
  const revenue = sampleSales.reduce((sum, value) => sum + value, 0);
  const orders = sampleTrend.reduce((sum, row) => sum + row.orders, 0);
  const totalUnits = sampleProducts.reduce(
    (sum, product) => sum + product.units,
    0,
  );
  return (
    <main className="rp-landing">
      <nav className="lp-nav">
        <a href="#" className="lp-brand-link" aria-label="RetailPlus home">
          <Brand />
        </a>
        <div>
          <a href="#inside">The workspace</a>
          <a href="#workflow">How it works</a>
          <a href="#made-for-retail">Made for retail</a>
        </div>
        <button className="lp-login" onClick={onLogin}>
          Open workspace
          <ArrowUpRight size={15} />
        </button>
      </nav>
      <section className="lp-hero">
        <div className="lp-hero-copy">
          <span className="lp-kicker">
            <span />A clearer view of your retail business
          </span>
          <h1>
            Know your store.
            <br />
            <span>Make your next move.</span>
          </h1>
          <p>
            Understand the sales, customers and products behind your business.
            Turn a messy spreadsheet into a clearer plan for what comes next.
          </p>
          <div className="lp-hero-actions">
            <button className="lp-primary" onClick={onLogin}>
              Open your workspace
              <ArrowRight size={16} />
            </button>
            <a href="#inside">
              Take a closer look
              <ChevronRight size={15} />
            </a>
          </div>
          <div className="lp-hero-notes">
            <span>
              <Check size={13} />
              Bring your own CSV
            </span>
            <span>
              <Check size={13} />
              Original data preserved
            </span>
          </div>
        </div>
        <div
          className="lp-hero-visual"
          aria-label="RetailPlus feature overview"
        >
          <div className="lp-visual-caption">
            <Sparkles size={13} />
            Find the signal. Decide what’s next.
          </div>
          <div className="lp-signal-card lp-signal-customer">
            <span className="lp-signal-icon">
              <UsersRound size={21} />
            </span>
            <div>
              <small>YOUR CUSTOMERS</small>
              <h3>Know who needs a check-in.</h3>
              <p>Purchase history, loyalty and signs of churn—in one place.</p>
            </div>
            <span className="lp-signal-tag">Customer health</span>
          </div>
          <div className="lp-signal-card lp-signal-products">
            <div className="lp-floating-products">
              <ProductIcon product="Headphones" size={30} />
              <ProductIcon product="Cotton shirt" size={30} />
              <ProductIcon product="Backpack" size={30} />
            </div>
            <div>
              <small>YOUR NEXT BEST SELLER</small>
              <h3>See what’s moving.</h3>
              <p>
                Spot product patterns and explore next month’s demand baseline.
              </p>
            </div>
          </div>
          <div className="lp-visual-note">
            <span>
              <CheckCircle2 size={16} />
              Clear numbers. Traceable changes.
            </span>
            <Layers3 size={30} />
          </div>
        </div>
      </section>
      <section className="lp-preview" id="inside">
        <div className="lp-preview-top">
          <div>
            <span className="lp-preview-dot" />A little clarity, in one
            workspace.
          </div>
          <span>Interactive sample · not your account data</span>
        </div>
        <div className="lp-preview-shell">
          <aside>
            <Brand />
            <span className="lp-preview-workspace">
              <ShoppingBag size={14} />
              Sample store
            </span>
            {[
              { title: "Sales overview", icon: TrendingUp },
              { title: "Customer view", icon: UsersRound },
              { title: "Product mix", icon: Layers3 },
            ].map(({ title, icon: Icon }) => (
              <button
                key={title}
                className={preview === title ? "active" : ""}
                onClick={() => setPreview(title)}
              >
                <Icon size={15} />
                {title}
              </button>
            ))}
            <div className="lp-preview-saved">
              <Check size={12} />
              Your raw data stays yours.
            </div>
          </aside>
          <div className="lp-preview-content">
            <header>
              <div>
                <p>Sample workspace</p>
                <h2>{preview}</h2>
              </div>
              <span>
                <FileSpreadsheet size={13} />
                January sample
              </span>
            </header>
            {preview === "Sales overview" ? (
              <>
                <div className="lp-preview-metrics">
                  <div>
                    <span>Completed revenue</span>
                    <strong>{formatMoney(revenue)}</strong>
                    <small>Calculated from sample sales</small>
                  </div>
                  <div>
                    <span>Completed orders</span>
                    <strong>{orders}</strong>
                    <small>12 illustrative daily periods</small>
                  </div>
                  <div>
                    <span>Average order value</span>
                    <strong>{formatMoney(revenue / orders, 2)}</strong>
                    <small>Revenue ÷ completed orders</small>
                  </div>
                </div>
                <div className="lp-preview-cards">
                  <article>
                    <h3>Sales, with the bigger picture.</h3>
                    <SalesChart rows={sampleTrend} />
                  </article>
                  <article className="lp-preview-categories">
                    <h3>A closer look at your products</h3>
                    {sampleProducts.map((product) => (
                      <div key={product.name}>
                        <ProductIcon product={product.name} size={23} />
                        <div>
                          <span>{product.category}</span>
                          <div>
                            <i
                              style={{
                                width: `${(product.units / totalUnits) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                        <small>
                          {((product.units / totalUnits) * 100).toFixed(0)}%
                        </small>
                      </div>
                    ))}
                    <p>Unit share from the separate product sample.</p>
                  </article>
                </div>
              </>
            ) : preview === "Customer view" ? (
              <div className="lp-customer-tour">
                <div>
                  <span className="lp-tour-icon">
                    <UsersRound size={28} />
                  </span>
                  <h3>A relationship, not just a row.</h3>
                  <p>
                    See a customer’s spending, purchase rhythm and order history
                    together. When your dataset has enough history, model
                    estimates help you decide who deserves a closer look.
                  </p>
                  <button onClick={onLogin}>
                    Explore your customers
                    <ArrowRight size={14} />
                  </button>
                </div>
                <div className="lp-tour-profile">
                  <span>Inside every customer profile</span>
                  {[
                    "Completed spend & order value",
                    "Last purchase & buying rhythm",
                    "Estimated churn risk",
                    "Product-level purchase history",
                  ].map((item) => (
                    <p key={item}>
                      <CheckCircle2 size={15} />
                      {item}
                    </p>
                  ))}
                  <small>
                    Risk estimates are shown only after training on suitable
                    data.
                  </small>
                </div>
              </div>
            ) : (
              <div className="lp-product-tour">
                <div className="lp-tour-section-title">
                  <h3>Different products. Different stories.</h3>
                  <span>Illustrative product fixture</span>
                </div>
                {sampleProducts.map((product) => (
                  <div key={product.name}>
                    <ProductIcon product={product.name} size={27} />
                    <div>
                      <strong>{product.name}</strong>
                      <span>{product.category}</span>
                    </div>
                    <div>
                      <strong>{product.units}</strong>
                      <span>units sold</span>
                    </div>
                    <div>
                      <strong>
                        {formatMoney(product.price * product.units)}
                      </strong>
                      <span>completed revenue</span>
                    </div>
                  </div>
                ))}
                <p>
                  Use your own sales history to explore product performance and
                  the next-month demand baseline.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
      <section className="lp-workflow" id="workflow">
        <div className="lp-section-intro">
          <span className="lp-kicker">From spreadsheet to next step</span>
          <h2>
            Less sorting.
            <br />
            <span>More understanding.</span>
          </h2>
          <p>
            A connected workflow, built around the questions a retail business
            asks every day.
          </p>
        </div>
        <div className="lp-workflow-cards">
          {[
            {
              number: "01",
              icon: FileSpreadsheet,
              title: "Bring the messy spreadsheet.",
              text: "Import your CSV, review what was cleaned, and keep every change traceable. The original stays untouched.",
            },
            {
              number: "02",
              icon: UsersRound,
              title: "See the people and patterns.",
              text: "Explore sales, customers, product categories and locations in a focused workspace. Filter down to what matters.",
            },
            {
              number: "03",
              icon: TrendingUp,
              title: "Give the next move some context.",
              text: "Review risk estimates, product demand baselines and business signals—then share a report or take a closer look.",
            },
          ].map((item) => (
            <article key={item.number}>
              <div>
                <item.icon size={22} />
                <span>{item.number}</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="lp-retail" id="made-for-retail">
        <div>
          <span className="lp-kicker">Built around what you sell</span>
          <h2>
            A place for every
            <br />
            part of your store.
          </h2>
          <p>
            Customers, SKUs, categories and locations belong in the same
            picture. Map the columns you already have and start with your own
            data.
          </p>
          <button className="lp-login" onClick={onLogin}>
            Bring your first dataset
            <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="lp-category-grid">
          {[
            { name: "Electronics", product: "Wireless headphones" },
            { name: "Clothing", product: "Cotton shirt" },
            { name: "Accessories", product: "Travel backpack" },
            { name: "Home", product: "Desk lamp" },
            { name: "Fitness", product: "Yoga mat" },
            { name: "Kitchen", product: "Coffee press" },
          ].map((item) => (
            <div key={item.name}>
              <ProductIcon
                product={item.product}
                category={item.name}
                size={35}
              />
              <span>{item.name}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="lp-final-cta">
        <img
          src="/brand/retailplus-cart-plus.png"
          alt=""
          width="72"
          height="72"
        />
        <h2>
          Your data has a story.
          <br />
          <span>Start seeing it.</span>
        </h2>
        <p>
          One workspace for the numbers, people and products behind your store.
        </p>
        <button className="lp-primary" onClick={onLogin}>
          Open RetailPlus
          <ArrowRight size={16} />
        </button>
        <span>
          <LockKeyhole size={12} />
          Sign in to access your workspace
        </span>
      </section>
      <footer className="lp-footer">
        <Brand />
        <span>Clarity for the business behind the numbers.</span>
        <a href="#">Back to top ↑</a>
      </footer>
    </main>
  );
}
