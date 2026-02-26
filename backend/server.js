import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { router as apiRouter } from './routes/index.js';
import { startReminderJob } from './jobs/reminderJob.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Pilates Scheduler API' });
});
app.use('/api', apiRouter);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  startReminderJob();
});
