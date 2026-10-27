import { normCdf } from "@/lib/engine/normal";
import type { OptionType } from "@/lib/engine/types";

export type BsArgs = {
  spot: number;
  strike: number;
  /** Calendar days to maturity. */
  days: number;
  /** Forward growth rate. */
  growth: number;
  /** Discount yield. */
  discount: number;
  vol: number;
  type: OptionType;
};

/**
 * The workbook price: forward F = S·e^{gT}, Black formula on F, discounted at r.
 * Written in the same order as the worksheet so the rounding matches.
 */
export function bsPrice({ spot, strike, days, growth, discount, vol, type }: BsArgs): number {
  if (!(days > 0) || !(vol > 0) || !(spot > 0) || !(strike > 0)) {
    if (days <= 0) {
      const intrinsic = type === "P" ? Math.max(strike - spot, 0) : Math.max(spot - strike, 0);
      return intrinsic;
    }
    return NaN;
  }
  const t = days / 365;
  const fwd = spot * Math.exp((growth * days) / 365);
  const sqrtT = Math.sqrt(t);
  const ln = Math.log(fwd / strike);
  const half = (0.5 * vol * vol * days) / 365;
  const df = Math.exp((-1 * discount * days) / 365);
  if (type === "C") {
    const d1 = (ln + half) / vol / sqrtT;
    const d2 = (ln - half) / vol / sqrtT;
    return (fwd * normCdf(d1) - strike * normCdf(d2)) * df;
  }
  const nd1 = (-1 * ln - half) / vol / sqrtT;
  const nd2 = (-1 * ln + half) / vol / sqrtT;
  return (-1 * fwd * normCdf(nd1) + strike * normCdf(nd2)) * df;
}

export type BsGreeks = {
  price: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
};

/** Bump and reprice, using the workbook bump sizes. */
export function bsGreeks(args: BsArgs): BsGreeks {
  const price = bsPrice(args);
  const up = bsPrice({ ...args, spot: args.spot + 0.5 });
  const down = bsPrice({ ...args, spot: args.spot - 0.5 });
  const up1 = bsPrice({ ...args, spot: args.spot + 1 });
  const down1 = bsPrice({ ...args, spot: args.spot - 1 });
  const theta = bsPrice({ ...args, days: args.days - 1 }) - price;
  const vega = bsPrice({ ...args, vol: args.vol + 0.01 }) - price;
  const rho = bsPrice({ ...args, growth: args.growth + 0.01, discount: args.discount + 0.01 }) - price;
  return {
    price,
    delta: up - down,
    gamma: up1 + down1 - 2 * price,
    theta,
    vega,
    rho,
  };
}
