/**
 * Shared Framer Motion presets for the Primary SP desk. Entrances are CSS (.hs-enter in app/globals.css).
 * Respects prefers-reduced-motion via useReducedMotion at call sites.
 */

const deskEase = [0.22, 1, 0.36, 1] as const;

/** Opacity and transform changes run 150 to 200 ms. */
export const deskFade = { duration: 0.18, ease: deskEase };
