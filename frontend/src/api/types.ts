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
