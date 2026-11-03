import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Database } from "../types";

// Persistence for the dev store: one JSON file (data/admin-dev.json, gitignored).
// Every write runs on a fresh copy of the data and is saved with an atomic rename
// only if it succeeds, so a failed action changes nothing, like a rolled-back
// transaction. Writes are queued, so two actions never interleave.

export type StoreFile = {
  version: 1;
  /** Signs demo session cookies. Generated with the file; never leaves the server. */
  session_secret: string;
  seeded_at: string;
  tables: Database;
};

export interface DevStore {
  read<T>(fn: (data: Database) => T): Promise<T>;
  write<T>(fn: (data: Database) => T): Promise<T>;
  sessionSecret(): Promise<string>;
}

/** In-memory store for tests. */
export function memoryStore(tables: Database, secret = "test-secret"): DevStore {
  let data = tables;
  return {
    read: async (fn) => fn(data),
    write: async (fn) => {
      const draft = structuredClone(data);
      const result = fn(draft);
      data = draft;
      return result;
    },
    sessionSecret: async () => secret,
  };
}

export function fileStore(file: string, seed: () => Database): DevStore {
  let cache: { mtimeMs: number; contents: StoreFile } | null = null;
  let queue: Promise<unknown> = Promise.resolve();

  const save = (contents: StoreFile) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(contents, null, 2));
    fs.renameSync(tmp, file);
    cache = { mtimeMs: fs.statSync(file).mtimeMs, contents };
  };

  const load = (): StoreFile => {
    let stat: fs.Stats | null = null;
    try {
      stat = fs.statSync(file);
    } catch {
      // No file yet: seed one.
    }
    if (!stat) {
      const contents: StoreFile = {
        version: 1,
        session_secret: randomBytes(32).toString("hex"),
        seeded_at: new Date().toISOString(),
        tables: seed(),
      };
      save(contents);
      return contents;
    }
    // Re-read when the file changed on disk (another worker, or a hand edit).
    if (!cache || cache.mtimeMs !== stat.mtimeMs) {
      cache = { mtimeMs: stat.mtimeMs, contents: JSON.parse(fs.readFileSync(file, "utf8")) as StoreFile };
    }
    return cache.contents;
  };

  const serial = <T>(task: () => T): Promise<T> => {
    const run = queue.then(task);
    queue = run.catch(() => undefined);
    return run;
  };

  return {
    read: async (fn) => fn(structuredClone(load().tables)),
    write: (fn) =>
      serial(() => {
        const current = load();
        const draft = structuredClone(current.tables);
        const result = fn(draft);
        save({ ...current, tables: draft });
        return result;
      }),
    sessionSecret: async () => load().session_secret,
  };
}
