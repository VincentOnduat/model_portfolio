import { Router } from 'express';
import { z } from 'zod';
import { AllocationListStatus, AllocationListType, Permission, roleHasPermission } from '@model-portfolio/shared';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { ApiException, asyncHandler } from '../middleware/errorHandler.js';
import * as AllocationService from '../services/allocationLists.service.js';

/** Guide 4.2: Money Allocation / Rebalance main page and 3-step wizard. */
export const allocationListsRouter = Router();

allocationListsRouter.use(requireAuth, requirePermission(Permission.ALLOCATION_ACCESS));

const listQuerySchema = z.object({
  type: z.nativeEnum(AllocationListType).optional(),
  status: z.nativeEnum(AllocationListStatus).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

allocationListsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const filters = listQuerySchema.parse(req.query);
    res.json(await AllocationService.listAllocationLists(filters));
  }),
);

const createSchema = z.object({
  type: z.nativeEnum(AllocationListType),
  name: z.string().min(1).max(200),
  accounts: z
    .array(
      z.object({
        accountId: z.string().uuid(),
        allocateAll: z.boolean().optional(),
        allocationAmount: z.number().nonnegative().optional(),
      }),
    )
    .min(1),
});

allocationListsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    const requiredPermission =
      input.type === AllocationListType.MONEY_ALLOCATION
        ? Permission.ALLOCATE_MONEY
        : Permission.REBALANCE;
    if (!req.user || !roleHasPermission(req.user.role, requiredPermission)) {
      throw new ApiException(403, 'FORBIDDEN', `Role lacks ${requiredPermission}.`);
    }
    const list = await AllocationService.createAllocationList(req.user!, input);
    res.status(201).json(list);
  }),
);

allocationListsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const list = await AllocationService.getAllocationListOrThrow(req.params.id);
    res.json(AllocationService.serializeAllocationList(list));
  }),
);

allocationListsRouter.post(
  '/:id/generate-orders',
  asyncHandler(async (req, res) => {
    res.json(await AllocationService.generateOrders(req.user!, req.params.id));
  }),
);

allocationListsRouter.post(
  '/:id/confirm-orders',
  asyncHandler(async (req, res) => {
    res.json(await AllocationService.confirmOrders(req.user!, req.params.id));
  }),
);

const removeOrdersSchema = z.object({ orderLineIds: z.array(z.string().uuid()).min(1) });

allocationListsRouter.post(
  '/:id/remove-orders',
  asyncHandler(async (req, res) => {
    const { orderLineIds } = removeOrdersSchema.parse(req.body);
    res.json(await AllocationService.removeOrderLines(req.user!, req.params.id, orderLineIds));
  }),
);

allocationListsRouter.delete(
  '/:id',
  requirePermission(Permission.DELETE_ALLOCATION_LIST),
  asyncHandler(async (req, res) => {
    await AllocationService.deleteAllocationList(req.user!, req.params.id);
    res.status(204).send();
  }),
);
