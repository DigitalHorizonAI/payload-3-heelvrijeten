import * as migration_20241125_222020_initial from './20241125_222020_initial';
import * as migration_20241214_124128 from './20241214_124128';
import * as migration_20260222_003500_payload_3_77_compat from './20260222_003500_payload_3_77_compat';
import * as migration_20260728_120000_drop_comments from './20260728_120000_drop_comments';
import * as migration_20260728_181752_add_logo_cloud_grid_block from './20260728_181752_add_logo_cloud_grid_block';
import * as migration_20260729_071028_add_api_clients from './20260729_071028_add_api_clients';
import * as migration_20260804_113226_add_legacy_path from './20260804_113226_add_legacy_path';
import * as migration_20260804_140000_add_byline from './20260804_140000_add_byline';

export const migrations = [
  {
    up: migration_20241125_222020_initial.up,
    down: migration_20241125_222020_initial.down,
    name: '20241125_222020_initial',
  },
  {
    up: migration_20241214_124128.up,
    down: migration_20241214_124128.down,
    name: '20241214_124128',
  },
  {
    up: migration_20260222_003500_payload_3_77_compat.up,
    down: migration_20260222_003500_payload_3_77_compat.down,
    name: '20260222_003500_payload_3_77_compat',
  },
  {
    up: migration_20260728_120000_drop_comments.up,
    down: migration_20260728_120000_drop_comments.down,
    name: '20260728_120000_drop_comments',
  },
  {
    up: migration_20260728_181752_add_logo_cloud_grid_block.up,
    down: migration_20260728_181752_add_logo_cloud_grid_block.down,
    name: '20260728_181752_add_logo_cloud_grid_block',
  },
  {
    up: migration_20260729_071028_add_api_clients.up,
    down: migration_20260729_071028_add_api_clients.down,
    name: '20260729_071028_add_api_clients',
  },
  {
    up: migration_20260804_113226_add_legacy_path.up,
    down: migration_20260804_113226_add_legacy_path.down,
    name: '20260804_113226_add_legacy_path'
  },
  {
    up: migration_20260804_140000_add_byline.up,
    down: migration_20260804_140000_add_byline.down,
    name: '20260804_140000_add_byline'
  },
];
