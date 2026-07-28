import { Router, Request, Response } from 'express';
import { roleMiddleware } from '../middlewares/role.middleware';
import { ROLES } from '../config/constants';
import { caseLifecycleService } from '../services/case-lifecycle.service';

const router = Router();

const OPS_AND_MD_ROLES = [
  ROLES.OPERATIONS_TEAM_L1,
  ROLES.OPERATIONS_TEAM_L2,
  ROLES.OPERATIONS_HEAD,
  ROLES.MD,
];

const CALENDAR_ROLES = [
  ROLES.RELATIONSHIP_MANAGER,
  ROLES.OPERATIONS_TEAM_L1,
  ROLES.OPERATIONS_TEAM_L2,
  ROLES.OPERATIONS_HEAD,
  ROLES.CEO,
  ROLES.CFO,
  ROLES.MD,
];

const parseDate = (value: unknown): Date | undefined => {
  if (!value || Array.isArray(value)) return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const parsePositiveInt = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

router.get('/post-sanction-checklists', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: caseLifecycleService.getPostSanctionChecklists(),
  });
});

router.get('/customers/:customerId/renewals', async (req: Request, res: Response) => {
  try {
    const summary = await caseLifecycleService.getRenewalSummary(Number(req.params.customerId));
    res.json({ success: true, data: summary });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post(
  '/customers/:customerId/renewals/start',
  roleMiddleware(OPS_AND_MD_ROLES),
  async (req: Request, res: Response) => {
    try {
      const result = await caseLifecycleService.startRenewal(
        Number(req.params.customerId),
        req.userId!,
        req.body?.remarks,
      );
      res.json({
        success: true,
        message: 'Renewal initiated and sent to RM',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },
);

router.post(
  '/customers/:customerId/hold',
  roleMiddleware(OPS_AND_MD_ROLES),
  async (req: Request, res: Response) => {
    try {
      const result = await caseLifecycleService.holdCase(
        Number(req.params.customerId),
        req.userId!,
        req.body?.reason || req.body?.remarks,
      );
      res.json({ success: true, message: 'Case placed on hold', data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },
);

router.post(
  '/customers/:customerId/resume',
  roleMiddleware(OPS_AND_MD_ROLES),
  async (req: Request, res: Response) => {
    try {
      const result = await caseLifecycleService.resumeCase(
        Number(req.params.customerId),
        req.userId!,
        req.body?.remarks,
      );
      res.json({ success: true, message: 'Case resumed', data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },
);

router.post(
  '/customers/:customerId/archive',
  roleMiddleware([ROLES.MD]),
  async (req: Request, res: Response) => {
    try {
      const result = await caseLifecycleService.archiveCase(
        Number(req.params.customerId),
        req.userId!,
        req.body?.reason || req.body?.remarks,
      );
      res.json({ success: true, message: 'Case archived', data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },
);

router.post(
  '/customers/:customerId/reassign-rm',
  roleMiddleware([ROLES.MD]),
  async (req: Request, res: Response) => {
    try {
      const newRmId = Number(req.body?.newRmId || req.body?.rmId);
      if (!Number.isInteger(newRmId) || newRmId <= 0) {
        res.status(400).json({ success: false, message: 'Valid newRmId is required' });
        return;
      }

      const result = await caseLifecycleService.reassignRM(
        Number(req.params.customerId),
        newRmId,
        req.userId!,
        req.body?.remarks,
      );
      res.json({ success: true, message: 'RM reassigned', data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },
);

router.get('/calendar/rms', roleMiddleware(CALENDAR_ROLES), async (_req: Request, res: Response) => {
  try {
    const relationshipManagers = await caseLifecycleService.getRelationshipManagers();
    res.json({ success: true, data: relationshipManagers });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/calendar', roleMiddleware(CALENDAR_ROLES), async (req: Request, res: Response) => {
  try {
    const events = await caseLifecycleService.getCalendarEvents({
      startDate: parseDate(req.query.startDate),
      endDate: parseDate(req.query.endDate),
      rmId: parsePositiveInt(req.query.rmId),
    });
    res.json({ success: true, data: events });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/reminders/run', roleMiddleware([ROLES.SUPERADMIN, ROLES.MD]), async (_req: Request, res: Response) => {
  try {
    const result = await caseLifecycleService.sendDueReminders();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
