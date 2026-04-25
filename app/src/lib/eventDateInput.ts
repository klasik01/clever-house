/**
 * V18-S33 — pure date helpery pro EventComposer + EventDetail.
 *
 * Konvence: ukládáme `event.startAt` / `event.endAt` jako ISO UTC string.
 * Pro all-day eventy bereme date jako "floating" — UTC midnight literálně
 * (`YYYY-MM-DDT00:00:00.000Z`), bez lokální TZ konverze. Pro timed events
 * konvertujeme local datetime ↔ ISO normálně (Date object respektuje TZ).
 *
 * Důvod proč floating UTC pro all-day: vstup `2026-04-30T00:00` v CZ TZ
 * (UTC+2 v dubnu) by `new Date()` interpretoval jako lokální čas a
 * `toISOString()` vrátil `2026-04-29T22:00:00Z`. Apple Calendar pak
 * zobrazí 29. dubna místo 30. dubna. Floating UTC tomu zabrání.
 */

/** Zaokrouhlí čas na nejbližší půlhodinu nahoru (UX — user píše např. 14:00). */
export function roundToNextHalfHour(d: Date): Date {
  const rounded = new Date(d);
  const mins = rounded.getMinutes();
  if (mins === 0 || mins === 30) {
    rounded.setSeconds(0, 0);
  } else if (mins < 30) {
    rounded.setMinutes(30, 0, 0);
  } else {
    rounded.setHours(rounded.getHours() + 1, 0, 0, 0);
  }
  return rounded;
}

/** Date → "YYYY-MM-DDTHH:MM" v lokální TZ (pro `<input type="datetime-local">`). */
export function toLocalInput(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/**
 * "YYYY-MM-DDTHH:MM" v lokální TZ → ISO UTC.
 *
 * `isAllDay`: pro celodenní eventy interpretujeme date part jako
 * "floating date" (UTC midnight literálně). Pro non-all-day pokračujeme
 * s lokální TZ konverzí.
 */
export function localInputToIso(local: string, isAllDay = false): string {
  if (!local) return "";
  if (isAllDay) {
    // Bere jen date část, zbytek ignoruje. Vrací UTC midnight.
    const datePart = local.slice(0, 10); // "YYYY-MM-DD"
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return "";
    return `${datePart}T00:00:00.000Z`;
  }
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

/**
 * ISO UTC → "YYYY-MM-DDTHH:MM" v lokální TZ (pro edit pre-fill).
 *
 * `isAllDay`: pro celodenní bere UTC date část (ne lokální), aby user
 * v jiné TZ než CZ viděl při edit ten samý den, který byl uložen.
 */
export function isoToLocalInput(iso: string, isAllDay = false): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (isAllDay) {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return (
      `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
      `T00:00`
    );
  }
  return toLocalInput(d);
}
