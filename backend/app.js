/**
 * Express 앱 (listen 제외)
 * - 로컬: server.js에서 import 후 listen
 * - Vercel: api/[[...path]].js에서 import 후 (req, res) 전달
 */
import express from 'express';
import cors from 'cors';
import { router as apiRouter } from './routes/index.js';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Pilates Scheduler API' });
});
app.use('/api', apiRouter);

export default app;
