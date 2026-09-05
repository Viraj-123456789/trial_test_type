import 'express';

// Populated by the express.json() verify hook in app.ts — see ADR-0007.
declare module 'express-serve-static-core' {
  interface Request {
    rawBody?: Buffer;
  }
}
