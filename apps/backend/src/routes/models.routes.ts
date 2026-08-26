import { Router } from 'express';
import { z } from 'zod';
import { ModelAim, ModelRisk, ModelStatus, Permission } from '@model-portfolio/shared';
import { AssetSector as PrismaAssetSector } from '@prisma/client';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as ModelsService from '../services/models.service.js';
import { prisma } from '../lib/prisma.js';

export const modelsRouter = Router();

modelsRouter.use(requireAuth, requirePermission(Permission.MODEL_MANAGEMENT_ACCESS));

const listQuerySchema = z.object({
  status: z.nativeEnum(ModelStatus).optional(),
  mine: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

modelsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const models = await ModelsService.listModels({
      status: query.status,
      firmId: query.mine ? req.user!.firmId : undefined,
      page: query.page,
      pageSize: query.pageSize,
    });
    res.json(models);
  }),
);

const createModelSchema = z.object({
  reference: z.string().min(1).max(32),
  name: z.string().min(1).max(200),
  minimumTradeValue: z.number().nonnegative(),
  chargePercent: z.number().min(0).max(10).nullable().optional(),
  vatIncluded: z.boolean().nullable().optional(),
  aim: z.nativeEnum(ModelAim).optional(),
  risk: z.nativeEnum(ModelRisk).optional(),
});

modelsRouter.post(
  '/',
  requirePermission(Permission.CREATE_MODEL),
  asyncHandler(async (req, res) => {
    const input = createModelSchema.parse(req.body);
    const model = await ModelsService.createModel(req.user!, input);
    res.status(201).json(model);
  }),
);

modelsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const model = await ModelsService.getModelOrThrow(req.params.id);
    res.json(ModelsService.serializeModel(model));
  }),
);

const updateModelSchema = createModelSchema.omit({ reference: true }).partial();

modelsRouter.patch(
  '/:id',
  requirePermission(Permission.EDIT_MODEL),
  asyncHandler(async (req, res) => {
    const input = updateModelSchema.parse(req.body);
    const model = await ModelsService.updateModel(req.user!, req.params.id, input);
    res.json(model);
  }),
);

modelsRouter.delete(
  '/:id',
  requirePermission(Permission.DELETE_MODEL),
  asyncHandler(async (req, res) => {
    await ModelsService.deleteModel(req.user!, req.params.id);
    res.status(204).send();
  }),
);

modelsRouter.post(
  '/:id/lock',
  requirePermission(Permission.LOCK_MODEL),
  asyncHandler(async (req, res) => {
    const model = await ModelsService.setLock(req.user!, req.params.id, true);
    res.json(model);
  }),
);

modelsRouter.post(
  '/:id/unlock',
  requirePermission(Permission.LOCK_MODEL),
  asyncHandler(async (req, res) => {
    const model = await ModelsService.setLock(req.user!, req.params.id, false);
    res.json(model);
  }),
);

modelsRouter.post(
  '/:id/publish',
  requirePermission(Permission.EDIT_MODEL),
  asyncHandler(async (req, res) => {
    const model = await ModelsService.publishModel(req.user!, req.params.id);
    res.json(model);
  }),
);

const setAllocationSchema = z.object({
  entries: z
    .array(
      z.object({
        assetId: z.string().uuid(),
        percentAllocated: z.number().min(0).max(100),
      }),
    )
    .min(1),
});

// Guide 4.1.3: "Set Allocation Change" - replaces the model's full asset
// allocation set. The frontend also uses this for "Add Selected Assets to
// Model" (send the existing entries plus the newly selected ones at 0%) and
// for "Reset Allocation" (the frontend simply re-fetches the model instead
// of calling this endpoint, since reset is a local, unsaved-changes action).
modelsRouter.put(
  '/:id/allocation',
  requirePermission(Permission.ADD_EDIT_ASSETS),
  asyncHandler(async (req, res) => {
    const { entries } = setAllocationSchema.parse(req.body);
    const model = await ModelsService.setModelAllocation(req.user!, req.params.id, entries);
    res.json(model);
  }),
);

const availableAssetsQuerySchema = z.object({
  search: z.string().optional(),
});

// Guide 4.1.3 "Assets Available for the Model": assets not yet allocated to
// this model, searchable by name / ISIN / sector, 3+ characters.
modelsRouter.get(
  '/:id/available-assets',
  asyncHandler(async (req, res) => {
    const { search } = availableAssetsQuerySchema.parse(req.query);
    const model = await ModelsService.getModelOrThrow(req.params.id);
    const allocatedIds = model.assets.map((a) => a.assetId);

    const matchingSector = Object.values(PrismaAssetSector).find((s) => s === search?.toUpperCase());

    const assets = await prisma.asset.findMany({
      where: {
        id: { notIn: allocatedIds },
        isCash: false,
        ...(search && search.length >= 3
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { isin: { contains: search, mode: 'insensitive' } },
                ...(matchingSector ? [{ sector: matchingSector }] : []),
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      take: 100,
    });

    res.json(
      assets.map((a) => ({
        id: a.id,
        name: a.name,
        isin: a.isin,
        type: a.type,
        sector: a.sector,
        isCash: a.isCash,
        lastPrice: a.lastPrice == null ? null : Number(a.lastPrice),
      })),
    );
  }),
);
