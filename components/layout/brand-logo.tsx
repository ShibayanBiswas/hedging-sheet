import Image from "next/image";
import Link from "next/link";

export function BrandLogo({ compact }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex shrink-0 items-center" aria-label="Hedging Sheet home">
      <Image src="/brand/arwl-logo.png" alt="Anand Rathi Wealth" width={148} height={42} priority className={compact ? "h-7 w-auto" : "h-8 w-auto sm:h-10"} />
    </Link>
  );
}
