import { z } from 'zod';

const INVALID_ID = 'Format ID tidak valid.';

export const listRawMaterialsQuery = z.object({
  search: z.string().trim().max(100).optional(),
  category_id: z.string().uuid(INVALID_ID).optional(),
});

export const listProductionLinesQuery = z.object({
  /** Bila diisi, hanya lini di pabrik order style ini (dipakai form SPK). */
  order_detail_id: z.string().uuid(INVALID_ID).optional(),
});

export const listQcStandardsQuery = z.object({
  type_code: z.string().trim().length(2).optional(),
});

export type ListRawMaterialsQuery = z.infer<typeof listRawMaterialsQuery>;
export type ListProductionLinesQuery = z.infer<typeof listProductionLinesQuery>;
export type ListQcStandardsQuery = z.infer<typeof listQcStandardsQuery>;
