import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import {
  checkCalendarFreeBusy,
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarProfile,
  listCalendarEvents,
  updateCalendarEvent,
} from './server/calendarApi.ts';
import { attachLiveWebSocketHandler } from './server/liveBridge.ts';
import { pythonBridge } from './server/pythonBridge.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function extractBearerToken(req: express.Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  void pythonBridge.ensureStarted();

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/python/status', async (_req, res) => {
    const status = await pythonBridge.getStatus();
    res.json(status);
  });

  app.post('/api/python/analyze', async (req, res) => {
    const text = String(req.body?.text || '').trim();
    if (!text) {
      res.status(400).json({ error: 'Text is required for Python NLP analysis.' });
      return;
    }
    const languageHint = String(req.body?.languageHint || 'auto');
    const timeZone = String(req.body?.timeZone || 'Asia/Kolkata');
    const result = await pythonBridge.analyzeUtterance(text, languageHint, timeZone);
    if (!result) {
      res.status(503).json({ error: 'Python NLP engine is unavailable.' });
      return;
    }
    res.json(result);
  });

  app.post('/api/python/suggest-slots', async (req, res) => {
    const token = extractBearerToken(req);
    const targetDate = req.body?.targetDate
      ? String(req.body.targetDate)
      : new Date().toISOString().slice(0, 10);
    const timeZone = String(req.body?.timeZone || 'Asia/Kolkata');
    const durationMinutes = Number(req.body?.durationMinutes || 30);

    try {
      let busySlots: Array<{ start: string; end: string }> = Array.isArray(
        req.body?.busySlots
      )
        ? req.body.busySlots
        : [];

      if (token) {
        const dayStart = `${targetDate.slice(0, 10)}T00:00:00Z`;
        const dayEnd = `${targetDate.slice(0, 10)}T23:59:59Z`;
        const fb = await checkCalendarFreeBusy(token, {
          timeMin: dayStart,
          timeMax: dayEnd,
          timeZone,
        });
        busySlots = fb.busySlots || [];
      }

      const suggestions = await pythonBridge.suggestSlots({
        busySlots,
        targetDate,
        durationMinutes,
        timeZone,
      });
      res.json(suggestions);
    } catch (err: any) {
      res.status(err?.status || 500).json({
        error: err?.message || 'Failed to compute Python slot suggestions.',
      });
    }
  });

  app.get('/api/calendar/profile', async (req, res) => {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Missing Google Calendar authorization token.' });
      return;
    }
    try {
      const profile = await getCalendarProfile(token);
      res.json(profile);
    } catch (err: any) {
      res.status(err?.status || 500).json({ error: err?.message || 'Failed to load calendar profile.' });
    }
  });

  app.get('/api/calendar/events', async (req, res) => {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Missing Google Calendar authorization token.' });
      return;
    }
    const timeMin = String(req.query.timeMin || new Date().toISOString());
    const timeMax = String(
      req.query.timeMax || new Date(Date.now() + 7 * 86400_000).toISOString()
    );
    const q = req.query.q ? String(req.query.q) : undefined;

    try {
      const data = await listCalendarEvents(token, { timeMin, timeMax, q });
      res.json(data);
    } catch (err: any) {
      res.status(err?.status || 500).json({ error: err?.message || 'Failed to list calendar events.' });
    }
  });

  app.post('/api/calendar/events', async (req, res) => {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Missing Google Calendar authorization token.' });
      return;
    }
    try {
      const created = await createCalendarEvent(token, req.body);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(err?.status || 500).json({ error: err?.message || 'Failed to create calendar event.' });
    }
  });

  app.patch('/api/calendar/events/:eventId', async (req, res) => {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Missing Google Calendar authorization token.' });
      return;
    }
    try {
      const updated = await updateCalendarEvent(token, req.params.eventId, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(err?.status || 500).json({ error: err?.message || 'Failed to update calendar event.' });
    }
  });

  app.delete('/api/calendar/events/:eventId', async (req, res) => {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Missing Google Calendar authorization token.' });
      return;
    }
    try {
      await deleteCalendarEvent(token, req.params.eventId);
      res.json({ deleted: true, eventId: req.params.eventId });
    } catch (err: any) {
      res.status(err?.status || 500).json({ error: err?.message || 'Failed to delete calendar event.' });
    }
  });

  const httpServer = http.createServer(app);

  const wss = new WebSocketServer({ noServer: true });
  wss.on('connection', (ws) => {
    attachLiveWebSocketHandler(ws);
  });

  httpServer.on('upgrade', (request, socket, head) => {
    const reqUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (reqUrl.pathname === '/api/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  if (isProduction) {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Prabhat Personal AI Agent server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server startup failed:', err);
  process.exit(1);
});
