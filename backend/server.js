import 'dotenv/config';
import app from './app.js';
import { startReminderJob } from './jobs/reminderJob.js';

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  startReminderJob();
});
