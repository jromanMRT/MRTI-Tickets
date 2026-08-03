import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import healthRouter from './routes/health';
import ticketsRouter from './routes/tickets';
import categoriesRouter from './routes/categories';
import prioritiesRouter from './routes/priorities';
import statusesRouter from './routes/statuses';
import commentsRouter from './routes/comments';
import attachmentsRouter from './routes/attachments';
import assignmentsRouter from './routes/assignments';
import historyRouter from './routes/history';
import slaRouter from './routes/sla';
import dashboardRouter from './routes/dashboard';
import reportsRouter from './routes/reports';
import agentEventsRouter from './routes/agentEvents';
import { requireAuth } from './middlewares/auth';
import assigneesRouter from './routes/assignees';

export function createApp() {
  const app = express();
  // El backend solo se publica en 127.0.0.1 y recibe tráfico mediante Nginx.
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  const limiter = rateLimit({ windowMs: 60_000, max: 200 });
  app.use(limiter);

  app.use('/api/health', healthRouter);
  app.get('/api/session', requireAuth, (req, res) => {
    res.json({ success: true, data: req.user });
  });
  app.use('/api/tickets', ticketsRouter);
  app.use('/api/assignees', assigneesRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/priorities', prioritiesRouter);
  app.use('/api/statuses', statusesRouter);
  app.use('/api/tickets/:id/comments', commentsRouter);
  app.use('/api/tickets/:id/attachments', attachmentsRouter);
  app.use('/api/tickets/:id/assign', assignmentsRouter);
  app.use('/api/tickets/:id/history', historyRouter);
  app.use('/api/agent/events', agentEventsRouter);
  app.use('/api', slaRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/reports', reportsRouter);

  // basic error handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(err.status || 500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  });

  return app;
}
