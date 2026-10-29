export type ChartRow = Record<string, string | number>;
export type Analysis = {
  currency: string;
  kpis: Record<string, number>;
  trend: ChartRow[];
  best_products: ChartRow[];
  least_products: ChartRow[];
  categories: ChartRow[];
  cities: ChartRow[];
  states: ChartRow[];
  stores: ChartRow[];
  spending: ChartRow[];
  order_status: ChartRow[];
  customer_behavior: {
    purchasing_customers: number;
    repeat_customers: number;
    repeat_rate: number;
    new_orders: number;
    returning_orders: number;
  };
  period: { start: string | null; end: string | null };
  product_outlook: ProductOutlook;
  options: Record<string, string[]>;
  insights: string[];
  basis: string;
};

export type Customer = {
  customer_id: string;
  name?: string;
  gender?: string;
  email?: string;
  avatar_seed?: string;
  currency?: string;
  monetary: number;
  frequency: number;
  recency: number;
  probability: number;
  risk: string;
  segment: string;
  recommendation: string;
  average_order_value: number;
  tenure: number;
  orders?: ChartRow[];
};

export type CustomerOverview = {
  summary: {
    customers: number;
    revenue: number;
    average_spend: number;
    average_orders: number;
    high_risk: number;
    low_risk: number;
    medium_risk: number;
    returning: number;
    high_risk_spend: number;
  };
  segments: {
    segment: string;
    customers: number;
    spend: number;
    average_orders: number;
    average_recency: number;
  }[];
  scoring_date: string | null;
};

export type ProductOutlook = {
  available: boolean;
  month?: string;
  basis_start?: string;
  basis_end?: string;
  method: string;
  note: string;
  products: {
    product_id: string;
    product: string;
    baseline_units: number;
    last_month_units: number;
    change_percent: number | null;
    direction: string;
    history: { month: string; units: number }[];
  }[];
};
