// Only ever allow same-origin relative paths, never an absolute URL, so
// `return_to` can't be abused as an open redirect.
export function safeReturnTo(value: string | null | undefined, fallback = "/"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}
