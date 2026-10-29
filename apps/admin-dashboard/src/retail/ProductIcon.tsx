import {
  Armchair,
  Backpack,
  BookOpen,
  Box,
  Dumbbell,
  Footprints,
  Headphones,
  LampDesk,
  Shirt,
  Smartphone,
  Utensils,
  Watch,
  type LucideIcon,
} from "lucide-react";

const categories: {
  pattern: RegExp;
  icon: LucideIcon;
  color: string;
  label: string;
}[] = [
  {
    pattern: /headphone|earbud|audio|speaker/i,
    icon: Headphones,
    color: "#9382bd",
    label: "Audio",
  },
  {
    pattern: /electronic|phone|laptop|computer|tablet|charger|tech/i,
    icon: Smartphone,
    color: "#9382bd",
    label: "Electronics",
  },
  {
    pattern: /cloth|shirt|dress|fashion|jacket|skirt|pant/i,
    icon: Shirt,
    color: "#c28f78",
    label: "Clothing",
  },
  {
    pattern: /shoe|footwear|runner|sneaker|sandal/i,
    icon: Footprints,
    color: "#b09c65",
    label: "Footwear",
  },
  {
    pattern: /backpack|travel|bag|accessor/i,
    icon: Backpack,
    color: "#7c9caf",
    label: "Accessories",
  },
  {
    pattern: /watch|jewel/i,
    icon: Watch,
    color: "#b09c65",
    label: "Accessories",
  },
  { pattern: /lamp|light/i, icon: LampDesk, color: "#bd9a65", label: "Home" },
  {
    pattern: /home|furnit|chair|sofa|decor/i,
    icon: Armchair,
    color: "#91a681",
    label: "Home",
  },
  {
    pattern: /kitchen|coffee|food|cook|utensil|cup/i,
    icon: Utensils,
    color: "#c69775",
    label: "Kitchen",
  },
  {
    pattern: /fitness|sport|yoga|gym/i,
    icon: Dumbbell,
    color: "#7da18e",
    label: "Fitness",
  },
  {
    pattern: /stationery|notebook|book|paper|pen/i,
    icon: BookOpen,
    color: "#9ba27e",
    label: "Stationery",
  },
];

export function productCategory(product: string, category = "") {
  return (
    categories.find((item) => item.pattern.test(product)) ||
    categories.find((item) => item.pattern.test(category)) || {
      icon: Box,
      color: "#9ca990",
      label: category || "Product",
    }
  );
}

export default function ProductIcon({
  product,
  category = "",
  size = 24,
}: {
  product: string;
  category?: string;
  size?: number;
}) {
  const { icon: Icon, color, label } = productCategory(product, category);
  return (
    <span className="rp-category-icon" style={{ color }} title={label}>
      <Icon size={size} strokeWidth={1.65} aria-hidden="true" />
    </span>
  );
}
