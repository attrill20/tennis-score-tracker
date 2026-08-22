export function truncateName(name: string, maxLength = 20): string {
  return name.length > maxLength ? `${name.slice(0, maxLength - 1)}…` : name;
}
