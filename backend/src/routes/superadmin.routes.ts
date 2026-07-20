import { Router, Request, Response } from 'express';
import { permissionService } from '../services/permission.service';
import { taskTimeTrackingService } from '../services/task-time-tracking.service';
import { taskBucketService } from '../services/task-bucket.service';
import { rewardService } from '../services/reward.service';
import { superAdminAnalyticsService } from '../services/superadmin-analytics.service';
import { userPerformanceService } from '../services/user-performance.service';
import { CustomerOnboardingService } from '../services/customer-onboarding.service';
import { roleMiddleware } from '../middlewares/role.middleware';
import { ROLES } from '../config/constants';

const router = Router();

const parsePositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parseNonNegativeInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

const parseDateQuery = (value: unknown, endOfDay = false): Date | undefined => {
  if (!value || Array.isArray(value)) return undefined;

  const rawValue = String(value);
  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) return undefined;

  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    date.setHours(23, 59, 59, 999);
  }

  return date;
};

const parseDashboardPeriod = (value: unknown): number | 'all' => {
  if (!value || Array.isArray(value)) return 30;

  const normalizedValue = String(value).trim().toLowerCase();
  if (['all', 'all_time', 'all-time'].includes(normalizedValue)) {
    return 'all';
  }

  return Math.min(parsePositiveInt(value, 30), 365);
};

// ==========================================
// SUPERADMIN Dashboard & Analytics Routes
// ==========================================

/**
 * GET /api/superadmin/dashboard
 * Get complete SUPERADMIN dashboard overview
 */
router.get('/dashboard', roleMiddleware([ROLES.SUPERADMIN]), async (req: Request, res: Response) => {
  try {
    const period = parseDashboardPeriod(req.query.period || req.query.days);
    const analytics = await superAdminAnalyticsService.getCompleteAnalytics(period);
    res.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/superadmin/overview
 * Get dashboard overview stats
 */
router.get('/overview', roleMiddleware([ROLES.SUPERADMIN]), async (req: Request, res: Response) => {
  try {
    const overview = await superAdminAnalyticsService.getDashboardOverview();
    res.json({
      success: true,
      data: overview,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/superadmin/top-performers
 * Get top performers leaderboard
 */
router.get('/top-performers', roleMiddleware([ROLES.SUPERADMIN]), async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const performers = await superAdminAnalyticsService.getTopPerformers(limit);
    res.json({
      success: true,
      data: performers,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/superadmin/lowest-performers
 * Get lowest performers
 */
router.get('/lowest-performers', roleMiddleware([ROLES.SUPERADMIN]), async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const performers = await superAdminAnalyticsService.getLowestPerformers(limit);
    res.json({
      success: true,
      data: performers,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/superadmin/bucket-stats
 * Get bucket performance stats
 */
router.get('/bucket-stats', roleMiddleware([ROLES.SUPERADMIN]), async (req: Request, res: Response) => {
  try {
    const stats = await superAdminAnalyticsService.getBucketPerformanceStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/superadmin/l1l2-comparison
 * Get L1 vs L2 processing comparison
 */
router.get('/l1l2-comparison', roleMiddleware([ROLES.SUPERADMIN]), async (req: Request, res: Response) => {
  try {
    const comparison = await superAdminAnalyticsService.getL1L2ProcessingComparison();
    res.json({
      success: true,
      data: comparison,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/superadmin/fastest-closers
 * Get fastest closers ranking
 */
router.get('/fastest-closers', roleMiddleware([ROLES.SUPERADMIN]), async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const ranking = await superAdminAnalyticsService.getFastestClosersRanking(limit);
    res.json({
      success: true,
      data: ranking,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/superadmin/slowest-closers
 * Get slowest closers ranking
 */
router.get('/slowest-closers', roleMiddleware([ROLES.SUPERADMIN]), async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const ranking = await superAdminAnalyticsService.getSlowestClosersRanking(limit);
    res.json({
      success: true,
      data: ranking,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/superadmin/productivity-ranking
 * Get highest productivity ranking
 */
router.get('/productivity-ranking', roleMiddleware([ROLES.SUPERADMIN]), async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const ranking = await superAdminAnalyticsService.getHighestProductivityRanking(limit);
    res.json({
      success: true,
      data: ranking,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/superadmin/user-timings
 * Get user task timing analytics
 */
router.get('/user-timings', roleMiddleware([ROLES.SUPERADMIN]), async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
    const timings = await superAdminAnalyticsService.getUserTaskTimingAnalytics(userId);
    res.json({
      success: true,
      data: timings,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// Task Time Tracking Routes
// ==========================================

/**
 * POST /api/tasks/track
 * Create a new task tracking record
 */
router.post('/tasks/track', roleMiddleware([ROLES.SUPERADMIN]), async (req: Request, res: Response) => {
  try {
    const { userId, taskId, taskType, bucket } = req.body;
    const tracking = await taskTimeTrackingService.createTaskTracking({
      userId,
      taskId,
      taskType,
      bucket,
    });
    res.json({ success: true, data: tracking });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/tasks/:taskId/start
 * Mark task as started
 */
router.post('/tasks/:taskId/start', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const userId = req.userId!;
    const tracking = await taskTimeTrackingService.startTask(taskId, userId);
    res.json({ success: true, data: tracking });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/tasks/:taskId/complete
 * Mark task as completed
 */
router.post('/tasks/:taskId/complete', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const userId = req.userId!;
    const { l1TimeMinutes, l2TimeMinutes } = req.body;
    
    // Complete task tracking
    const tracking = await taskTimeTrackingService.completeTask(
      taskId, 
      userId, 
      l1TimeMinutes, 
      l2TimeMinutes
    );

    // Award reward points (if eligible)
    if (tracking?.totalCompletionTimeMinutes) {
      await rewardService.awardPoints({
        userId,
        taskId,
        completionTimeMinutes: tracking.totalCompletionTimeMinutes,
        bucket: tracking.bucket || undefined,
        taskType: tracking.taskType,
      });
    }

    res.json({ success: true, data: tracking });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/tasks/my-tasks
 * Get current user's task tracking
 */
router.get('/tasks/my-tasks', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { status, limit, offset } = req.query;
    
    const tasks = await taskTimeTrackingService.getUserTaskTracking(userId, {
      status: status as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    
    res.json({ success: true, data: tasks });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/tasks/my-stats
 * Get current user's task statistics
 */
router.get('/tasks/my-stats', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const stats = await taskTimeTrackingService.getUserTaskStats(userId);
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// Reward Points Routes
// ==========================================

/**
 * GET /api/rewards/leaderboard
 * Get rewards leaderboard
 */
router.get('/rewards/leaderboard', roleMiddleware([ROLES.SUPERADMIN]), async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const performers = await rewardService.getTopPerformers(limit);
    res.json({ success: true, data: performers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/rewards/monthly-leaderboard
 * Get monthly rewards leaderboard
 */
router.get('/rewards/monthly-leaderboard', roleMiddleware([ROLES.SUPERADMIN]), async (req: Request, res: Response) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || (new Date().getMonth() + 1);
    const limit = parseInt(req.query.limit as string) || 10;
    
    const leaders = await rewardService.getMonthlyLeaderboard(year, month, limit);
    res.json({ success: true, data: leaders });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/rewards/bucket-leaderboard
 * Get bucket/department rewards leaderboard
 */
router.get('/rewards/bucket-leaderboard', roleMiddleware([ROLES.SUPERADMIN]), async (req: Request, res: Response) => {
  try {
    const bucket = req.query.bucket as string;
    const limit = parseInt(req.query.limit as string) || 10;
    
    if (!bucket) {
      res.status(400).json({ success: false, message: 'Bucket parameter required' });
      return;
    }
    
    const leaders = await rewardService.getBucketLeaderboard(bucket, limit);
    res.json({ success: true, data: leaders });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/rewards/my-rewards
 * Get current user's rewards
 */
router.get('/rewards/my-rewards', roleMiddleware([ROLES.ADMIN, ROLES.SUPERADMIN]), async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const rewards = await rewardService.getUserRewards(userId, limit);
    const totalPoints = await rewardService.getUserTotalPoints(userId);
    
    res.json({ 
      success: true, 
      data: {
        rewards,
        totalPoints,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/rewards/config
 * Get reward configurations
 */
router.get('/rewards/config', roleMiddleware([ROLES.SUPERADMIN]), async (req: Request, res: Response) => {
  try {
    const configs = await rewardService.getRewardConfigurations();
    res.json({ success: true, data: configs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/rewards/config
 * Update reward configuration (SUPERADMIN only)
 */
router.put('/rewards/config', roleMiddleware([ROLES.SUPERADMIN]), async (req: Request, res: Response) => {
  try {
    const { category, points, maxMinutes, minMinutes, description } = req.body;
    
    const config = await rewardService.updateRewardConfig({
      category,
      points,
      maxMinutes,
      minMinutes,
      description,
    });
    
    res.json({ success: true, data: config });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// Task Bucket Mapping Routes
// ==========================================

/**
 * GET /api/buckets
 * Get all bucket mappings
 */
router.get('/buckets', roleMiddleware([ROLES.SUPERADMIN]), async (req: Request, res: Response) => {
  try {
    const buckets = await taskBucketService.getAllBucketMappings();
    res.json({ success: true, data: buckets });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/buckets/distribution
 * Get task distribution by role and user
 */
router.get('/buckets/distribution', roleMiddleware([ROLES.SUPERADMIN]), async (req: Request, res: Response) => {
  try {
    const byRole = await taskBucketService.getTaskDistributionByRole();
    const byUser = await taskBucketService.getTaskDistributionByUser();
    
    res.json({ 
      success: true, 
      data: {
        byRole,
        byUser,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/buckets
 * Create bucket mapping (SUPERADMIN only)
 */
router.post('/buckets', roleMiddleware([ROLES.SUPERADMIN]), async (req: Request, res: Response) => {
  try {
    const { roleId, bucketName, description, priority, taskTypeFilter } = req.body;
    
    const mapping = await taskBucketService.createBucketMapping({
      roleId,
      bucketName,
      description,
      priority,
      taskTypeFilter,
    });
    
    res.json({ success: true, data: mapping });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// Role & Permission Routes
// ==========================================

/**
 * GET /api/users/:userId/roles
 * Get user's roles (multi-role support)
 */
router.get('/users/:userId/roles', roleMiddleware([ROLES.SUPERADMIN]), async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const roles = await permissionService.getUserRoles(userId);
    const permissions = await permissionService.getUserPermissionNames(userId);
    
    res.json({ 
      success: true, 
      data: {
        roles,
        permissions,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/users/:userId/roles
 * Assign role to user
 */
router.post('/users/:userId/roles', roleMiddleware([ROLES.SUPERADMIN]), async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const { roleId } = req.body;
    const assignedBy = req.userId;
    
    const userRole = await permissionService.assignRoleToUser(userId, roleId, assignedBy);
    res.json({ success: true, data: userRole });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/users/:userId/roles/:roleId
 * Remove role from user
 */
router.delete('/users/:userId/roles/:roleId', roleMiddleware([ROLES.SUPERADMIN]), async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const roleId = parseInt(req.params.roleId);
    
    await permissionService.removeRoleFromUser(userId, roleId);
    res.json({ success: true, message: 'Role removed successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/roles/superadmin/init
 * Initialize SUPERADMIN role (one-time setup)
 */
router.post('/roles/superadmin/init', async (req: Request, res: Response) => {
  try {
    const role = await permissionService.createSuperAdminRole();
    res.json({ success: true, data: role, message: 'SUPERADMIN role created successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/users/:userId/check-access
 * Check if user can access target user's data
 */
router.get('/users/:userId/check-access', async (req: Request, res: Response) => {
  try {
    const viewerId = req.userId!;
    const targetUserId = parseInt(req.params.userId);
    
    const canView = await permissionService.canViewUserData(viewerId, targetUserId);
    const isSuperAdmin = await permissionService.hasSuperAdminRole(viewerId);
    const isEligible = await permissionService.isEligibleForRewards(targetUserId);
    
    res.json({ 
      success: true, 
      data: {
        canViewAllData: canView,
        isSuperAdmin,
        isRewardEligible: isEligible,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// User Performance Routes (SUPERADMIN only)
// ==========================================

/**
 * GET /api/superadmin/user-performance/summary
 * Get overall performance summary
 */
router.get('/user-performance/summary', roleMiddleware([ROLES.SUPERADMIN]), async (req: Request, res: Response) => {
  try {
    const summary = await userPerformanceService.getOverallSummary();
    res.json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/superadmin/user-performance/list
 * Get user performance list with filters
 */
router.get('/user-performance/list', roleMiddleware([ROLES.SUPERADMIN]), async (req: Request, res: Response) => {
  try {
    const { 
      startDate, 
      endDate, 
      stage, 
      userId, 
      limit, 
      offset, 
      sortBy, 
      sortOrder 
    } = req.query;

    const filters = {
      startDate: parseDateQuery(startDate),
      endDate: parseDateQuery(endDate, true),
      stage: stage as string,
      userId: userId ? parseInt(userId as string) : undefined,
      limit: limit ? parseInt(limit as string) : 20,
      offset: offset ? parseInt(offset as string) : 0,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'ASC' | 'DESC',
    };

    const result = await userPerformanceService.getUserPerformanceList(filters);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/superadmin/user-performance/users
 * Get all users for filter dropdown
 */
router.get('/user-performance/users', roleMiddleware([ROLES.SUPERADMIN]), async (req: Request, res: Response) => {
  try {
    const users = await userPerformanceService.getAllUsersForFilter();
    res.json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/superadmin/user-performance/:userId
 * Get detailed performance for a specific user
 */
router.get('/user-performance/:userId', roleMiddleware([ROLES.SUPERADMIN]), async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const { startDate, endDate, stage } = req.query;

    const filters = {
      startDate: parseDateQuery(startDate),
      endDate: parseDateQuery(endDate, true),
      stage: stage as string,
    };

    const detail = await userPerformanceService.getUserPerformanceDetail(userId, filters);
    
    if (!detail) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Get recent completed cases
    const recentCases = await userPerformanceService.getUserRecentCompletedCases(userId, 10);

    res.json({ success: true, data: { ...detail, recentCases } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/superadmin/cases/company-suggestions
 * Search matching company names for the All Cases filter
 */
router.get('/cases/company-suggestions', roleMiddleware([ROLES.SUPERADMIN]), async (req: Request, res: Response) => {
  try {
    const search = String(req.query.companyName || req.query.q || '');
    const limit = Math.min(parsePositiveInt(req.query.limit, 8), 20);
    const suggestions = await userPerformanceService.getCompanyNameSuggestions(search, limit);

    res.json({ success: true, data: suggestions });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/superadmin/cases
 * Get all cases across all users for SUPERADMIN view
 * Uses workflow data similar to user dashboards
 * Supports filtering by stage, status, user, and date range
 * 
 * UPDATED: Fixed visibility and filter issues
 * - All fields always present in response
 * - assigned_to always visible
 * - completed_at always visible  
 * - status field appears correctly
 * - Filters work correctly
 */
router.get('/cases', roleMiddleware([ROLES.SUPERADMIN]), async (req: Request, res: Response) => {
  try {
    const { 
      stage, 
      status, 
      companyName,
      userId, 
      startDate, 
      endDate,
      limit, 
      page,
      offset,
      includeSanctions
    } = req.query;

    const limitNum = parsePositiveInt(limit, 50);
    const offsetNum = offset !== undefined
      ? parseNonNegativeInt(offset, 0)
      : (parsePositiveInt(page, 1) - 1) * limitNum;
    const pageNum = Math.floor(offsetNum / limitNum) + 1;

    // Use the userPerformanceService which has proper filtering logic
    const filters = {
      stage: stage as string || undefined,
      status: status as string || undefined,
      companyName: companyName ? String(companyName).trim() : undefined,
      userId: userId ? parseInt(userId as string) : undefined,
      startDate: parseDateQuery(startDate),
      endDate: parseDateQuery(endDate, true),
      limit: limitNum,
      offset: offsetNum,
      includeSanctions: includeSanctions === 'true' || includeSanctions === '1',
    };

    const result = await userPerformanceService.getAllCasesByUsers(filters);

    // Transform response to ensure all fields are always present (SuperAdmin visibility fix)
    const casesWithVisibility = result.cases.map(c => ({
      ...c,
      // Ensure assigned_to is always visible
      assignedTo: c.userId || null,
      assignedToName: c.userName || null,
      assignedToEmail: c.userEmail || null,
      // Ensure created_at is always visible
      createdAt: c.createdAt || null,
      // Ensure completed_at is always visible
      completedAt: c.completedAt || null,
      // Ensure status is always visible
      status: c.status || 'pending',
      // Ensure role_stage_time is calculated correctly
      roleStageTime: c.totalCompletionTimeMinutes || null,
      l1TimeMinutes: c.l1ProcessingTimeMinutes || null,
      l2TimeMinutes: c.l2ProcessingTimeMinutes || null,
    }));

    // Calculate total pages
    const totalPages = Math.ceil(result.total / limitNum);

    res.json({ 
      success: true, 
      data: { 
        cases: casesWithVisibility, 
        total: result.total, 
        page: pageNum, 
        totalPages 
      } 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
