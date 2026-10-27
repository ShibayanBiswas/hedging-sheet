import Image from "next/image";
import Link from "next/link";

/** Both logos render; CSS picks one so the dark theme never flashes the light logo. */
export function BrandLogo() {
  return (
    <Link href="/" className="flex shrink-0 items-center" aria-label="Hedging Sheet home">
      <Image src="/brand/arwl-logo.png" alt="Anand Rathi Wealth" width={148} height={42} priority className="h-10 w-auto dark:hidden" />
      <Image src="/brand/arwl-logo-white.png" alt="Anand Rathi Wealth" width={148} height={42} priority className="hidden h-10 w-auto dark:block" />
    </Link>
  );
}
