"use client";

import type { ReactNode } from "react";
import { LazyMotion } from "framer-motion";

const loadFeatures = () => import("@/lib/motion-features").then((m) => m.default);

/** Every animation uses the slim m component; strict mode refuses a full motion component that would undo the saving. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      {children}
    </LazyMotion>
  );
}
