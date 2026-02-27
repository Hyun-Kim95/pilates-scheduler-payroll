import { query } from '../config/db.js';

async function main() {
  try {
    console.log('Altering reservations table: add start_time, end_time...');
    await query(
      `ALTER TABLE reservations
       ADD COLUMN start_time TIME NOT NULL AFTER member_id,
       ADD COLUMN end_time TIME NOT NULL AFTER start_time`
    );
    console.log('Done altering reservations table.');
  } catch (err) {
    console.error('Error while altering reservations table:', err);
  } finally {
    process.exit(0);
  }
}

main();

