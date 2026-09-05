import express, { Request } from 'express';
import { webhooksRouter } from './routes/webhooks';

export function createApp() {
  const app = express();

  // verify hook stashes the raw bytes on req.rawBody for webhook HMAC checks — see ADR-0007.
  // body-parser types this callback's req as the raw http.IncomingMessage, not
  // express.Request, hence the cast.
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as Request).rawBody = buf;
      },
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/webhooks', webhooksRouter);

  return app;
}
