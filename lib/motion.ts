/**
 * Shared Framer Motion presets for the Primary SP desk.
 * Respects prefers-reduced-motion via useReducedMotion at call sites.
 */

export const deskEase = [0.22, 1, 0.36, 1] as const;

export const pageEnter = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22, ease: deskEase },
};
