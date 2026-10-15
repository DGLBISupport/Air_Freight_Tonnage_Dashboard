export const recipientAssignmentCodes = (value: unknown): string[] =>
  Array.from(new Set(String(value || "").split(",").map(code => code.trim().toUpperCase()).filter(Boolean)));

/** Report membership is explicit; a branch's parent is never added here. */
export function buildRecipientGroups(users: any[], mode: "AIR" | "SEA"): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const user of users) {
    if (mode === "SEA" ? user.is_sea !== true : user.is_air === false) continue;
    const email = String(user.email || "").trim().toLowerCase();
    if (!email) continue;
    for (const code of recipientAssignmentCodes(user.station)) {
      const emails = groups[code] || (groups[code] = []);
      if (!emails.includes(email)) emails.push(email);
    }
  }
  return groups;
}

export function updateRecipientAssignment(value: unknown, target: string, removing = false): string {
  const code = target.trim().toUpperCase();
  const assignments = recipientAssignmentCodes(value).filter(existing => existing !== code);
  if (!removing && code) assignments.push(code);
  return assignments.join(", ");
}
