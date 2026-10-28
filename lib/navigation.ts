import { BarChart3, BookOpenText, Calculator, Database, LayoutDashboard, Network, ShieldCheck, SlidersHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  /** Output tabs need a Run Simulation first. */
  needsRun: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { id: "inputs", href: "/", label: "Inputs", icon: SlidersHorizontal, needsRun: false },
  { id: "summary", href: "/summary", label: "Summary Sheet", icon: LayoutDashboard, needsRun: true },
  { id: "pricer", href: "/pricer", label: "Pricer", icon: Calculator, needsRun: true },
  { id: "product", href: "/product", label: "Product Description", icon: BookOpenText, needsRun: true },
  { id: "vega-hedge", href: "/vega-hedge", label: "Day 1 Vega Hedge", icon: ShieldCheck, needsRun: true },
  { id: "margin", href: "/margin", label: "Mark to Market and Margin", icon: BarChart3, needsRun: true },
  { id: "market-data", href: "/market-data", label: "Market Data", icon: Database, needsRun: false },
  { id: "logic-atlas", href: "/logic-atlas", label: "Logic Atlas", icon: Network, needsRun: false },
];

export function activeNav(pathname: string): NavItem {
  return NAV_ITEMS.find((item) => (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href))) ?? NAV_ITEMS[0]!;
}
