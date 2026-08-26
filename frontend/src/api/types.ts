export interface Photo {
  id: number;
  filename: string;
  caption: string | null;
  uploaded_at: string;
  url: string;
  position?: number;
  // Person photos only; event photos have no folders.
  folder_id?: number | null;
}

export interface Folder {
  id: number;
  name: string;
}

export interface Person {
  id: number;
  slug: string;
  display_name: string;
  bio: string | null;
  profile_image: string | null;
  profile_image_url: string | null;
}

export interface PersonDetailData extends Person {
  birth_date: string | null;
  death_date: string | null;
  birthplace: string | null;
  profession: string | null;
}

export interface PersonDetail {
  person: PersonDetailData;
  photos: Photo[];
  folders: Folder[];
}

export type EventKind = "wedding" | "christening" | "funeral" | "gathering";

export interface Event {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  event_time: string | null;
  place: string | null;
  kind: EventKind | null;
  cover_filename: string | null;
  cover_url: string | null;
}

export type EventDetailData = Omit<Event, "cover_filename" | "cover_url">;

export interface EventDetail {
  event: EventDetailData;
  photos: Photo[];
}

export interface PersonCreate {
  display_name: string;
  slug?: string;
  bio?: string | null;
  birth_date?: string | null;
  death_date?: string | null;
  birthplace?: string | null;
  profession?: string | null;
}

export type PersonUpdate = Partial<Omit<PersonCreate, "slug">>;

export interface EventCreate {
  name: string;
  slug?: string;
  description?: string | null;
  event_time?: string | null;
  place?: string | null;
  kind?: EventKind | null;
}

export type EventUpdate = Partial<Omit<EventCreate, "slug">>;

export interface Collection {
  id: number;
  slug: string;
  name: string;
  info: string | null;
  profile_image: string | null;
  cover_filename: string | null;
  cover_url: string | null;
}

export type CollectionDetailData = Omit<Collection, "cover_filename" | "cover_url"> & {
  profile_image_url: string | null;
};

export interface CollectionDetail {
  collection: CollectionDetailData;
  photos: Photo[];
  folders: Folder[];
}

export interface CollectionCreate {
  name: string;
  slug?: string;
  info?: string | null;
}

export type CollectionUpdate = Partial<Omit<CollectionCreate, "slug">>;

export interface Contact {
  id: number;
  position: number;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
}

export interface ContactCreate {
  name: string;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
}

export type ContactUpdate = Partial<ContactCreate>;

export interface FamilyLineMember {
  slug: string;
  display_name: string;
}

export interface FamilyLine {
  id: number;
  slug: string;
  name: string;
  year_range: string | null;
  note: string | null;
  position: number;
  members: FamilyLineMember[];
}

export interface FamilyLineCreate {
  name: string;
  slug?: string;
  year_range?: string | null;
  note?: string | null;
}

export type FamilyLineUpdate = Partial<Omit<FamilyLineCreate, "slug">>;

export interface UploadResult {
  saved: number;
  skipped: number;
}

export interface CaptionUpdated {
  ok: boolean;
}
