import type {
  Person,
  PersonDetail,
  Event,
  EventDetail,
  Collection,
  CollectionDetail,
  Contact,
  FamilyLine,
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

export function getCollections(): Promise<Collection[]> {
  return request<Collection[]>("/api/collections");
}

export function getCollection(slug: string): Promise<CollectionDetail> {
  return request<CollectionDetail>(`/api/collections/${encodeURIComponent(slug)}`);
}

export function getContacts(): Promise<Contact[]> {
  return request<Contact[]>("/api/contacts");
}

export function getFamilyLines(): Promise<FamilyLine[]> {
  return request<FamilyLine[]>("/api/family-lines");
}
