import 'server-only';
import { cache } from 'react';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  Entity,
  EntityId,
  Filing,
  FilingId,
  Merge,
  Person,
  PersonId,
  Relationship,
  RelId,
  SyncedAt,
} from './types';

const DATA_DIR = path.join(process.cwd(), 'data');

async function readJson<T>(filename: string): Promise<T> {
  const raw = await fs.readFile(path.join(DATA_DIR, filename), 'utf8');
  return JSON.parse(raw) as T;
}

export const getFilings = cache((): Promise<Filing[]> => readJson<Filing[]>('filings.json'));
export const getEntities = cache((): Promise<Entity[]> => readJson<Entity[]>('entities.json'));
export const getPersons = cache((): Promise<Person[]> => readJson<Person[]>('persons.json'));
export const getRelationships = cache((): Promise<Relationship[]> => readJson<Relationship[]>('relationships.json'));
export const getMerges = cache((): Promise<Merge[]> => readJson<Merge[]>('merges.json'));
export const getSyncedAt = cache((): Promise<SyncedAt> => readJson<SyncedAt>('synced-at.json'));

export const getMethodology = cache(async (): Promise<string> => {
  return fs.readFile(path.join(DATA_DIR, 'methodology.md'), 'utf8');
});

export async function getFiling(id: FilingId): Promise<Filing | null> {
  const filings = await getFilings();
  return filings.find((f) => f.filing_id === id) ?? null;
}

export async function getEntity(id: EntityId): Promise<Entity | null> {
  const entities = await getEntities();
  return entities.find((e) => e.entity_id === id) ?? null;
}

export async function getPerson(id: PersonId): Promise<Person | null> {
  const persons = await getPersons();
  return persons.find((p) => p.person_id === id) ?? null;
}

export async function getRelationship(id: RelId): Promise<Relationship | null> {
  const rels = await getRelationships();
  return rels.find((r) => r.relationship_id === id) ?? null;
}

export async function getRelationshipsForFiling(id: FilingId): Promise<Relationship[]> {
  const rels = await getRelationships();
  return rels.filter((r) => r.filing_source === id);
}

export async function getRelationshipsForEntity(id: EntityId): Promise<Relationship[]> {
  const rels = await getRelationships();
  return rels.filter((r) => r.source_id === id || r.target_id === id);
}

export async function getRelationshipsForPerson(id: PersonId): Promise<Relationship[]> {
  const rels = await getRelationships();
  return rels.filter((r) => r.source_id === id || r.target_id === id);
}

export async function getFilingsForPerson(id: PersonId): Promise<Filing[]> {
  const filings = await getFilings();
  return filings.filter((f) => f.filer_id === id);
}

export async function getMergesForEntity(id: EntityId): Promise<{ asWinner: Merge[]; asLoser: Merge[] }> {
  const merges = await getMerges();
  return {
    asWinner: merges.filter((m) => m.winner_id === id),
    asLoser: merges.filter((m) => m.loser_id === id),
  };
}

export type EntityIndex = Map<EntityId, Entity>;
export type PersonIndex = Map<PersonId, Person>;
export type FilingIndex = Map<FilingId, Filing>;

export const getEntityIndex = cache(async (): Promise<EntityIndex> => {
  const entities = await getEntities();
  return new Map(entities.map((e) => [e.entity_id, e]));
});

export const getPersonIndex = cache(async (): Promise<PersonIndex> => {
  const persons = await getPersons();
  return new Map(persons.map((p) => [p.person_id, p]));
});

export const getFilingIndex = cache(async (): Promise<FilingIndex> => {
  const filings = await getFilings();
  return new Map(filings.map((f) => [f.filing_id, f]));
});

export function isEntityId(id: string): id is EntityId {
  return id.startsWith('cp_entity_');
}

export function isPersonId(id: string): id is PersonId {
  return id.startsWith('cp_person_');
}

export function isFilingId(id: string): id is FilingId {
  return id.startsWith('cp_filing_');
}
