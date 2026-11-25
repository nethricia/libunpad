import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

const runtimeConfig = useRuntimeConfig();

// build a connection pool only when configuration is present
let db: any;
if (runtimeConfig.dbHost) {
  const connection = await mysql.createPool({
    host: runtimeConfig.dbHost,
    user: runtimeConfig.dbUsername,
    database: runtimeConfig.dbName,
    password: runtimeConfig.dbPassword,
    port: Number(runtimeConfig.dbPort),
    // TLS when enabled (KANDAGA_DRIZZLE_SSL=true). Verify the server cert.
    ...(runtimeConfig.dbSsl
      ? { ssl: { rejectUnauthorized: true } }
      : {}),
    // Bound the pool and fail fast instead of queueing forever.
    connectionLimit: Number(runtimeConfig.dbConnectionLimit ?? 10),
    waitForConnections: true,
    queueLimit: 0,
    connectTimeout: 10_000,
    enableKeepAlive: true,
  });

  db = drizzle(connection);
} else {
  // no database configured; export a no-op object that can be chained safely
  const noop = () => ({
    from: () => noop(),
    where: () => noop(),
    limit: () => noop(),
    offset: () => noop(),
  });
  db = {
    select: noop,
    // add additional helpers here if you call them elsewhere
  } as any;
}

export { db };
