import type { Location, LocationGroup, Task } from "@/types";

export const LOCATION_GROUPS: { id: LocationGroup; i18nKey: string }[] = [
  { id: "outdoor", i18nKey: "locations.groupOutdoor" },
  { id: "general", i18nKey: "locations.groupGeneral" },
  { id: "living", i18nKey: "locations.groupLiving" },
  { id: "hygiene", i18nKey: "locations.groupHygiene" },
];

export const LOCATIONS: Location[] = [
  // Venkovní
  { id: "pozemek-zahrada", label: "Pozemek / zahrada", group: "outdoor" },
  { id: "okoli-domu", label: "Okolí domu", group: "outdoor" },
  { id: "dvorek-pred-domem", label: "Dvorek před domem", group: "outdoor" },
  { id: "zahradni-domek", label: "Zahradní domek", group: "outdoor" },
  { id: "terasa", label: "Terasa / venkovní posezení", group: "outdoor" },
  // Dům obecně
  { id: "dum-obecne", label: "Dům (obecně)", group: "general" },
  { id: "zadveri", label: "Zádveří", group: "general" },
  { id: "chodba", label: "Chodba", group: "general" },
  { id: "garaz", label: "Garáž", group: "general" },
  { id: "dilna", label: "Dílna", group: "general" },
  { id: "technicka-mistnost", label: "Technická místnost", group: "general" },
  // Obytné prostory
  { id: "obyvaci-pokoj", label: "Obývací pokoj", group: "living" },
  { id: "kuchyn", label: "Kuchyň", group: "living" },
  { id: "loznice", label: "Ložnice", group: "living" },
  { id: "detsky-pokoj", label: "Dětský pokoj", group: "living" },
  { id: "pokoj-pro-hosty", label: "Pokoj pro hosty", group: "living" },
  { id: "pracovna", label: "Pracovna", group: "living" },
  // Hygiena + wellness
  { id: "koupelna", label: "Koupelna", group: "hygiene" },
  { id: "wc", label: "WC", group: "hygiene" },
  { id: "wellness", label: "Wellness", group: "hygiene" },
];

export function getLocation(id: string | null | undefined): Location | undefined {
  if (!id) return undefined;
  return LOCATIONS.find((l) => l.id === id);
}

export function locationsByGroup(): {
  group: LocationGroup;
  i18nKey: string;
  items: Location[];
}[] {
  return LOCATION_GROUPS.map((g) => ({
    group: g.id,
    i18nKey: g.i18nKey,
    items: LOCATIONS.filter((l) => l.group === g.id),
  }));
}

export function applyLocation(tasks: Task[], locationId: string | null): Task[] {
  if (!locationId) return tasks;
  return tasks.filter((t) => t.locationId === locationId);
}
