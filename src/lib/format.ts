export function formatDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export const formatMoney = (amount: number) => usd.format(amount);
