export interface Photo {
  id: number;
  filename: string;
  caption: string | null;
  uploaded_at: string;
  url: string;
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
  birth_year: number | null;
  death_year: number | null;
  birthplace: string | null;
  profession: string | null;
}

export interface PersonDetail {
  person: PersonDetailData;
  photos: Photo[];
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
  birth_year?: number | null;
  death_year?: number | null;
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

export interface UploadResult {
  saved: number;
  skipped: number;
}

export interface CaptionUpdated {
  ok: boolean;
}
