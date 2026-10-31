// Text ULIDs for every primary key: sortable by creation time, 26 characters, URL safe.
import { ulid } from "ulid";

export function newId(): string {
  return ulid();
}

export function nowMs(): number {
  return Date.now();
}
