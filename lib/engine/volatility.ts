// Summary I26 = I25 × √365
export function annualVolFromDaily(daily: number): number {
  return daily * Math.sqrt(365);
}

export function dailyVolFromAnnual(annual: number): number {
  return annual / Math.sqrt(365);
}
