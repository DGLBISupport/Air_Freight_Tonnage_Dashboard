/** Wrap chart labels at word boundaries, including identifiers with no spaces. */
export function wrapSeaGroupLabel(name: string, width: number, fontSize: number): string[] {
  const context = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  if (context) context.font = `600 ${fontSize}px Arial`;
  const measure = (value: string) => context?.measureText(value).width ?? value.length * fontSize;
  const lines: string[] = [];
  let current = "";
  for (const word of name.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate) <= width) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = "";
    for (const letter of word) {
      if (current && measure(current + letter) > width) {
        lines.push(current);
        current = "";
      }
      current += letter;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [name];
}
