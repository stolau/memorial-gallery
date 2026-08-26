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

export interface Event {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  event_time: string | null;
  place: string | null;
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
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}

export interface UploadResult {
  saved: number;
  skipped: number;
}

export interface CaptionUpdated {
  ok: boolean;
}
