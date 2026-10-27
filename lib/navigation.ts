import {
  BarChart3,
  BookOpenText,
  Calculator,
  Database,
  LayoutDashboard,
  Network,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { id: "inputs", href: "/", label: "Inputs", icon: SlidersHorizontal },
  { id: "summary", href: "/summary", label: "Summary Sheet", icon: LayoutDashboard },
  { id: "pricer", href: "/pricer", label: "Pricer", icon: Calculator },
  { id: "product", href: "/product", label: "Product Description", icon: BookOpenText },
  { id: "vega-hedge", href: "/vega-hedge", label: "Day 1 Vega Hedge", icon: ShieldCheck },
  { id: "margin", href: "/margin", label: "Mark to Market and Margin", icon: BarChart3 },
  { id: "market-data", href: "/market-data", label: "Market Data", icon: Database },
  { id: "logic-atlas", href: "/logic-atlas", label: "Logic Atlas", icon: Network },
];

export function activeNav(pathname: string): NavItem {
  return NAV_ITEMS.find((item) => (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href))) ?? NAV_ITEMS[0]!;
}
