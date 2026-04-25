import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Event } from "@/types";

/**
 * V18-S20 — počet eventů kde aktuální user musí udělat akci:
 *   - Autor + status `AWAITING_CONFIRMATION` (musí potvrdit Proběhlo / Zrušilo se)
 *   - Pozvaný + status `UPCOMING` + bez `rsvps/{uid}` záznamu
 *
 * Live subscription přes 2 paralelní queries (createdBy + array-contains)
 * — Firestore neumí cross-field OR. Dedupe přes Map. RSVP info se zatím
 * nečte z subkolekcí (drahé n+1) — pendingRsvpMineCount je pesimistická
 * (počítá invitees bez ohledu na RSVP). V další iteraci přidáme batch
 * RSVP fetch pokud bude badge příliš agresivní.
 */
export function useEventsActionCount(uid: string | undefined): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!uid) {
      setCount(0);
      return;
    }
    const map = new Map<string, Event>();
    const recompute = () => {
      let n = 0;
      for (const ev of map.values()) {
        // Autor + AWAITING → potřebuje potvrzení
        if (ev.createdBy === uid && ev.status === "AWAITING_CONFIRMATION") {
          n++;
          continue;
        }
        // Pozvaný + UPCOMING → počítáme jako "neodpověděný"
        // (přesný RSVP filter v MVP zjednodušený — V2 dotaz na rsvps
        // subkolekci pro precise badge)
        if (
          ev.createdBy !== uid &&
          ev.inviteeUids.includes(uid) &&
          ev.status === "UPCOMING"
        ) {
          n++;
        }
      }
      setCount(n);
    };

    const q1 = query(collection(db, "events"), where("createdBy", "==", uid));
    const q2 = query(
      collection(db, "events"),
      where("inviteeUids", "array-contains", uid),
    );
    const handle = (snap: { docs: Array<{ id: string; data: () => unknown }> }) => {
      for (const d of snap.docs) {
        const data = d.data() as Partial<Event>;
        map.set(d.id, {
          id: d.id,
          title: data.title ?? "",
          description: data.description ?? "",
          startAt: data.startAt ?? "",
          endAt: data.endAt ?? "",
          isAllDay: data.isAllDay === true,
          address: data.address ?? "",
          inviteeUids: Array.isArray(data.inviteeUids) ? data.inviteeUids : [],
          createdBy: data.createdBy ?? "",
          authorRole: data.authorRole,
          status: (data.status ?? "UPCOMING") as Event["status"],
          linkedTaskId: data.linkedTaskId ?? null,
          happenedConfirmedAt: data.happenedConfirmedAt ?? null,
          cancelledAt: data.cancelledAt ?? null,
          createdAt: data.createdAt ?? "",
          updatedAt: data.updatedAt ?? "",
          reminderSentAt: data.reminderSentAt ?? null,
        });
      }
      recompute();
    };
    const unsub1 = onSnapshot(q1, handle);
    const unsub2 = onSnapshot(q2, handle);
    return () => {
      unsub1();
      unsub2();
      map.clear();
    };
  }, [uid]);

  return count;
}
