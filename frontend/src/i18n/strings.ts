export type Lang = "fi" | "en";

export const strings: Record<Lang, Record<string, string>> = {
  fi: {
    "nav.events": "Tapahtumat",
    "people.title": "Henkilöt",
    "events.title": "Tapahtumat",
    "events.empty": "Ei vielä tapahtumia.",
    "common.loading": "Ladataan…",
    "person.born": "Syntynyt",
    "person.died": "Kuollut",
    "person.birthplace": "Syntymäpaikka",
    "person.profession": "Ammatti",
    "event.time": "Aika",
    "event.place": "Paikka",
    "photos.empty": "Ei vielä valokuvia.",
  },
  en: {
    "nav.events": "Events",
    "people.title": "People",
    "events.title": "Events",
    "events.empty": "No events yet.",
    "common.loading": "Loading…",
    "person.born": "Born",
    "person.died": "Died",
    "person.birthplace": "Birthplace",
    "person.profession": "Profession",
    "event.time": "Time",
    "event.place": "Place",
    "photos.empty": "No photos yet.",
  },
};
