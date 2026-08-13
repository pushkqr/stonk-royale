/** Sub-dollar tickers need more decimals than a $200 one. */
export function price(value) {
  if (value == null) return "—";
  if (value >= 100) return value.toFixed(2);
  if (value >= 1) return value.toFixed(3);
  return value.toFixed(4);
}

export function money(value) {
  if (value == null) return "—";
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function signedMoney(value) {
  if (value == null) return "—";
  return `${value >= 0 ? "+" : "-"}$${Math.abs(value).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}

export function pct(value) {
  if (value == null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function clock(millis) {
  const total = Math.max(0, Math.ceil(millis / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export const toneOf = (value) => (value > 0 ? "pump" : value < 0 ? "dump" : "muted");
