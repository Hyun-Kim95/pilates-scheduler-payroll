import { Router } from 'express';
import { router as authRouter } from './auth.js';
import { router as instructorsRouter } from './instructors.js';
import { router as membersRouter } from './members.js';
import { router as scheduleSlotsRouter } from './scheduleSlots.js';
import { router as reservationsRouter } from './reservations.js';
import { router as payrollsRouter } from './payrolls.js';
import { router as statisticsRouter } from './statistics.js';
import { requireAuth } from '../middleware/auth.js';
import { runReminderJobOnce } from '../jobs/reminderJob.js';

export const router = Router();

router.get('/', (req, res) => res.json({ message: 'Pilates Scheduler API' }));

// Vercel Cron 등에서 호출 (CRON_SECRET 필요)
router.get('/cron/reminder', async (req, res) => {
  const secret = req.headers.authorization?.replace('Bearer ', '');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    await runReminderJobOnce();
    res.json({ ok: true, message: 'Reminder job ran' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Reminder job failed' });
  }
});

router.use('/auth', authRouter);
router.use('/instructors', requireAuth, instructorsRouter);
router.use('/members', requireAuth, membersRouter);
router.use('/schedule-slots', requireAuth, scheduleSlotsRouter);
router.use('/reservations', requireAuth, reservationsRouter);
router.use('/payrolls', payrollsRouter);
router.use('/statistics', requireAuth, statisticsRouter);
