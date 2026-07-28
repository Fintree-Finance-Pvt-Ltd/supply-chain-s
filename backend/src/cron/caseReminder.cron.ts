import cron from 'node-cron';
import { caseLifecycleService } from '../services/case-lifecycle.service';

let started = false;

export function startCaseReminderCron() {
  if (started) return;
  started = true;

  cron.schedule('0 9 * * *', async () => {
    try {
      const result = await caseLifecycleService.sendDueReminders();
      console.log('[CaseReminderCron] Completed', result);
    } catch (error) {
      console.error('[CaseReminderCron] Failed', error);
    }
  });
}
