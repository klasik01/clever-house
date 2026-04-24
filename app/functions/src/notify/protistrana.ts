/**
 * V16.4 — "protistrana" helper.
 *
 * Pro change events (priority / deadline / assigned) určuje komu poslat
 * notifikaci. Pravidlo: recipient = ten z {createdBy, assigneeUid}, kdo
 * NENÍ actor. Self-filter je rovnou vestavěný — actor se nikdy nevrátí.
 *
 * Platí jen pokud je task aktuálně assignutý (assigneeUid != null). Když
 * není, vrací null — změny na bezhlavém tasku nikoho netrápí dokud se
 * nepřiřadí.
 *
 * Speciální případy:
 *   - actor = createdBy = assigneeUid (self-assigned task, modifying it):
 *     nikdo jiný neexistuje → null.
 *   - actor mimo {createdBy, assigneeUid} (např. PM edituje cizí task):
 *     oba ostatní jsou relevantní, ale pro V16.4 MVP notify jen assignee
 *     (ten "má míč"). Author se o změně dozví z příštího comments fan-outu.
 *
 * Pure funkce — žádné I/O. Unit testy v protistrana.test.ts.
 */

export interface ProtistraiaInput {
  actorUid: string;
  createdBy: string;
  assigneeUid: string | null | undefined;
}

/** Vrátí uid příjemce, nebo null pokud se nemá posílat. */
export function protistrana(input: ProtistraiaInput): string | null {
  const assignee = input.assigneeUid ?? null;
  if (!assignee) return null;

  // Assignee sám si změnil → pošli autorovi (pokud není stejný).
  if (input.actorUid === assignee) {
    if (input.createdBy && input.createdBy !== assignee) {
      return input.createdBy;
    }
    return null;
  }

  // Autor si změnil vlastní task → pošli assignee.
  if (input.actorUid === input.createdBy) {
    return assignee;
  }

  // Někdo třetí (např. PM na OWNERově tasku): assignee má míč, dostane
  // notifikaci. Actor sám není v množině; další round (komentáře / další
  // zapojení) může autora zapojit jinak.
  return assignee;
}
