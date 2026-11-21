import {
  DefectTypeRepository,
  ProductionLineRepository,
  QcStandardRepository,
  RawMaterialRepository,
} from '../repositories/master-produksi.repository';
import type {
  ListProductionLinesQuery,
  ListQcStandardsQuery,
  ListRawMaterialsQuery,
} from '../schemas/master-produksi.schema';
import { BaseService } from './base.service';

/** Data master modul C untuk dropdown RSI (hanya baca). CRUD-nya ada di /smbd/* (tahap SMBD). */
export class MasterProduksiService extends BaseService {
  constructor(
    private readonly rawMaterials = new RawMaterialRepository(),
    private readonly lines = new ProductionLineRepository(),
    private readonly defects = new DefectTypeRepository(),
    private readonly standards = new QcStandardRepository(),
  ) {
    super();
  }

  listRawMaterials(query: ListRawMaterialsQuery) {
    return this.rawMaterials.findAll(query);
  }

  listProductionLines(query: ListProductionLinesQuery) {
    return this.lines.findAll(query);
  }

  listDefectTypes() {
    return this.defects.findAll();
  }

  listQcStandards(query: ListQcStandardsQuery) {
    return this.standards.findAll(query);
  }
}
