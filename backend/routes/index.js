import { Router } from 'express';
import { router as authRouter } from './auth.js';
import { router as instructorsRouter } from './instructors.js';
import { router as membersRouter } from './members.js';
import { router as scheduleSlotsRouter } from './scheduleSlots.js';
import { router as reservationsRouter } from './reservations.js';
import { router as payrollsRouter } from './payrolls.js';
import { requireAuth } from '../middleware/auth.js';

export const router = Router();

router.get('/', (req, res) => res.json({ message: 'Pilates Scheduler API' }));
router.use('/auth', authRouter);
router.use('/instructors', requireAuth, instructorsRouter);
router.use('/members', requireAuth, membersRouter);
router.use('/schedule-slots', requireAuth, scheduleSlotsRouter);
router.use('/reservations', requireAuth, reservationsRouter);
router.use('/payrolls', payrollsRouter);
