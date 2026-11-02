import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Page-level entrance, wrapping each route's main content once. It is plain CSS, so the server's HTML is already visible:
 * the fade needs no script to finish, and under reduced motion there is no fade at all.
 */
export function PageEnter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("desk-page-enter hs-enter", className)}>{children}</div>;
}
