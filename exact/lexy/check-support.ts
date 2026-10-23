import { Database } from 'bun:sqlite';
import type { Database as Connection, SQLCommand, SQLExecution, SQLRows, SQLValue, Storage, Store } from './app.contract.d.ts';

export function memoryStorage(options: {
  files?: Map<string, Uint8Array>;
  beforeWrite?: (commands: SQLCommand[]) => Promise<void>;
  afterQuery?: (sql: string, params: SQLValue[]) => void;
} = {}): { storage: Storage; database: Database } {
  const database = new Database(':memory:', { safeIntegers: true });
  const files = options.files ?? new Map<string, Uint8Array>();

  function run(sql: string, params: SQLValue[] = []): SQLExecution {
    const result = database.prepare(sql).run(...params);
    return { changes: result.changes, lastInsertRowid: BigInt(result.lastInsertRowid) };
  }

  function query(sql: string, params: SQLValue[] = []): SQLRows {
    const statement = database.prepare(sql);
    return { columns: statement.columnNames, rows: statement.values(...params) as SQLValue[][] };
  }

  const storage = {
    fs: {
      readdir: async (path: string): Promise<string[]> => [...files.keys()]
        .filter(key => key.startsWith(path + '/')).map(key => key.slice(path.length + 1)),
      readFile: async (path: string): Promise<ArrayBuffer> => {
        const bytes = files.get(path);
        if (!bytes) {
          throw new Error('ENOENT');
        }
        return bytes.slice().buffer;
      },
      rm: async (path: string): Promise<void> => {
        for (const key of files.keys()) {
          if (key === path || key.startsWith(path + '/')) {
            files.delete(key);
          }
        }
      },
    } as Storage['fs'],
    sqlite: {
      open: async (_path: string): Promise<Connection> => ({
        execute: async (sql: string, params?: SQLValue[]): Promise<SQLExecution> => {
          await options.beforeWrite?.([{ sql, params }]);
          return run(sql, params);
        },
        query: async (sql: string, params: SQLValue[] = []): Promise<SQLRows> => {
          const result = query(sql, params);
          options.afterQuery?.(sql, params);
          return result;
        },
        transaction: async (commands: SQLCommand[]): Promise<SQLExecution[]> => {
          await options.beforeWrite?.(commands);
          return database.transaction((): SQLExecution[] => commands.map(command => run(command.sql, command.params)))();
        },
        // Keep the in-memory database alive between the app's connections
        close: async (): Promise<void> => {},
      } as Connection),
    },
  } satisfies Storage;
  return { storage, database };
}

export function memoryStore(): Store {
  const values = new Map<string, string>();
  return {
    get: (key: string): string | null => values.get(key) ?? null,
    set: (key: string, value: string): void => { values.set(key, value); },
    forget: (key: string): void => { values.delete(key); },
  } as Store;
}
