import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/cn";

/** Both logos render; CSS picks one so the dark theme never flashes the light logo. */
export function BrandLogo({ compact }: { compact?: boolean }) {
  const size = compact ? "h-7 w-auto" : "h-10 w-auto";
  return (
    <Link href="/" className="flex shrink-0 items-center" aria-label="Hedging Sheet home">
      <Image src="/brand/arwl-logo.png" alt="Anand Rathi Wealth" width={148} height={42} priority className={cn(size, "dark:hidden")} />
      <Image src="/brand/arwl-logo-white.png" alt="Anand Rathi Wealth" width={148} height={42} priority className={cn(size, "hidden dark:block")} />
    </Link>
  );
}
