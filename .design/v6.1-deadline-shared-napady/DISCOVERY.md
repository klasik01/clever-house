# V6.1 — Shared nápady for PM + deadline escalation

## Problem statement
Po V6 restrukturalizaci tabů vznikly dvě skuliny:
1. PM ztratil přístup k Záznamům (nápadům, které mu OWNER sdílí), takže sdílené nápady
   šly vidět jen přes hluboký odkaz.
2. Deadline escalace byla měkká — "soon" = ≤ 2 dny, a po překročení termínu se to v
   seznamu nijak vizuálně neřvalo.

V6.1 to řeší: vrací Záznamy tab pro PM, zjednodušuje stránku (už žádné group-by
taby ani pro OWNERa) a zostřuje deadline chování u úkolů.

## Primary user
Jak PM, tak OWNER — oba sledují úkoly, jejichž termín je dnes/zítra nebo byl
překročen.

## Success metric
Počet úkolů po termínu, které zůstávají bez akce, klesne → protože jsou vizuálně
nepřehlédnutelné (červený levý border + vykřičník u titulku + červený deadline chip).

## Top 3 risks
1. **False-positive red** — úkol s `DONE` a překročeným termínem by se stále
   počítal jako "po termínu". Nezvýrazňovat DONE/CANCELED. Mitigace:
   deadlineState je počítán nezávisle, ale karta filtruje výchozí stav
   (Ukoly ball-on-me logic → DONE se nezobrazuje jako highlight, ale deadline
   by se zobrazoval). Další iterace: potlačit overdue flag pro DONE/CANCELED.
2. **Border-l-4 kolize** — overdue border vyhraje nad ball-on-me border
   (priorita: overdue > ball-on-me). Současná implementace to řeší větvením
   ternárem.
3. **Deadline "soon" threshold** — ≤ 1 den může být moc pozdě pro některé
   úkoly. Pokud si user bude stěžovat, vrátíme se k 2-3 dnům nebo uděláme
   per-priority hranici (P1 = 2 dny, P2 = 1 den, P3 = den of).

## Rozhodnutí

| Aspekt | Rozhodnutí |
|---|---|
| Záznamy tab pro PM | Ano. Viditelnost stejná jako dosud (jen `sharedWithPm: true`). |
| Group-by tabs | Odstraněny pro OWNER i PM. Jen chip filtry. |
| "Soon" threshold | `≤ 1 kalendářní den` (dnes nebo zítra). |
| Overdue highlight | `border-l-4` v danger barvě + `AlertTriangle` ikona před titulkem. |
| DeadlineChip | Žádná změna palety (ok / soon / overdue styly už existují). |

## Implementation checklist

- [x] Zaznamy.tsx — odebrat group-by state + GroupBy import + TaskGroupedView, nahradit TaskList.
- [x] Shell.tsx — přidat Záznamy tab pro PM (stejný styl jako OWNER, bez badge).
- [x] lib/deadline.ts — `deadlineState` počítá diff v celých dnech, "soon" ≤ 1 den.
- [x] NapadCard.tsx — přidat `isOverdue` check, AlertTriangle před titulkem, `border-l-4` s danger barvou přes inline style.

