export function shiftFromTime(date: Date = new Date()): "morning" | "afternoon" | "night" {
  const hour = date.getHours();
  if (hour >= 6 && hour < 14) return "morning";
  if (hour >= 14 && hour < 22) return "afternoon";
  return "night";
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function woProgress(actual: number, planned: number): number {
  if (planned === 0) return 0;
  return Math.min(100, Math.round((actual / planned) * 100));
}

export function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
