import {
  activityLogsRepository,
  type ActivityLogRecord,
  type ActivityLogsRepository,
} from '../repositories/activity-logs.repository';
import type { ListActivityLogsQuery } from '../schemas/activity-logs.schema';
import type { PaginationMeta } from '../utils/response';
import { BaseService } from './base.service';

export class ActivityLogsService extends BaseService {
  constructor(
    private readonly repository: ActivityLogsRepository = activityLogsRepository,
  ) {
    super('rsi');
  }

  async listActivityLogs(
    query: ListActivityLogsQuery,
  ): Promise<{ items: ActivityLogRecord[]; meta: PaginationMeta }> {
    const { items, total } = await this.repository.findPaginated({
      page: query.page,
      per_page: query.per_page,
      action_type: query.action_type,
      username: query.username,
      resource_type: query.resource_type,
      date_from: query.date_from,
      date_to: query.date_to,
    });

    const last_page = Math.max(1, Math.ceil(total / query.per_page));
    return {
      items,
      meta: {
        current_page: query.page,
        per_page: query.per_page,
        total,
        last_page,
      },
    };
  }
}

export const activityLogsService = new ActivityLogsService();