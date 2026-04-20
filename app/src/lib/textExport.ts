import type { Category, Task } from "@/types";
import { getLocation } from "./locations";

/** Plain-text export — fallback if PDF generation fails, or for quick WA paste. */
export function tasksToPlainText(
  tasks: Task[],
  categories: Category[],
  title: string
): string {
  const now = new Date().toLocaleString("cs-CZ");
  const lines: string[] = [];
  lines.push(title);
  lines.push("=".repeat(Math.min(title.length, 60)));
  lines.push(`Vygenerováno: ${now}`);
  lines.push("");

  if (tasks.length === 0) {
    lines.push("(žádné záznamy)");
    return lines.join("\n");
  }

  tasks.forEach((task, i) => {
    const category = task.categoryId
      ? categories.find((c) => c.id === task.categoryId)?.label
      : null;
    const location = getLocation(task.locationId)?.label ?? null;

    lines.push(`${i + 1}. [${task.status}]`);
    if (category) lines.push(`   Kategorie: ${category}`);
    if (location) lines.push(`   Lokace: ${location}`);
    lines.push("");
    const body = task.body.trim() || task.title.trim() || "(bez textu)";
    for (const row of body.split("\n")) lines.push(`   ${row}`);
    if (task.attachmentLinkUrl) {
      lines.push(`   Odkaz: ${task.attachmentLinkUrl}`);
    }
    if (task.attachmentImageUrl) {
      lines.push(`   Obrázek: ${task.attachmentImageUrl}`);
    }
    if (task.projektantAnswer) {
      lines.push("");
      lines.push(`   Odpověď Projektanta:`);
      for (const row of task.projektantAnswer.split("\n")) lines.push(`     ${row}`);
    }
    lines.push("");
    lines.push("-".repeat(40));
    lines.push("");
  });

  return lines.join("\n");
}
