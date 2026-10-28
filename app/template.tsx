import type { ReactNode } from "react";

import { PageEnter } from "@/components/ui/page-motion";

/** Route change transition, as the Primary SP Dashboard pages enter. */
export default function Template({ children }: { children: ReactNode }) {
  return <PageEnter>{children}</PageEnter>;
}
