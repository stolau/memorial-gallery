import type {
  Person,
  PersonDetail,
  Event,
  EventDetail,
} from "./types";

async function request<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "include" });
  if (!res.ok) {
    throw new Error(`Request to ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function getPeople(): Promise<Person[]> {
  return request<Person[]>("/api/people");
}

export function getPerson(slug: string): Promise<PersonDetail> {
  return request<PersonDetail>(`/api/people/${encodeURIComponent(slug)}`);
}

export function getEvents(): Promise<Event[]> {
  return request<Event[]>("/api/events");
}

export function getEvent(slug: string): Promise<EventDetail> {
  return request<EventDetail>(`/api/events/${encodeURIComponent(slug)}`);
}
