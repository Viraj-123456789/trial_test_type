import { Pool, types } from 'pg';
import { env } from '../config/env';

// pg returns BIGINT (OID 20) columns as strings by default, since JS numbers can't
// safely represent the full int8 range. Our bigserial ids stay well under
// Number.MAX_SAFE_INTEGER, so parse them to numbers app-wide rather than threading
// string ids through every model/service.
types.setTypeParser(20, (value: string) => parseInt(value, 10));

export const pool = new Pool({ connectionString: env.databaseUrl });
