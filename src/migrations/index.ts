import * as migration_20241125_222020_initial from './20241125_222020_initial';
import * as migration_20241214_124128 from './20241214_124128';
import * as migration_20260222_003500_payload_3_77_compat from './20260222_003500_payload_3_77_compat';
import * as migration_20260728_120000_drop_comments from './20260728_120000_drop_comments';
// Kept from the vanilla eject: this migration is already RECORDED in the
// production payload_migrations table (the template deployed it), so the file
// must exist here or the record and the filesystem disagree. Our Pages
// collection has no Logo Cloud Grid block; the tables it created sit unused.
import * as migration_20260728_181752_add_logo_cloud_grid_block from './20260728_181752_add_logo_cloud_grid_block';
import * as migration_20260729_071028_add_api_clients from './20260729_071028_add_api_clients';

export const migrations = [
  {
    up: migration_20241125_222020_initial.up,
    down: migration_20241125_222020_initial.down,
    name: '20241125_222020_initial',
  },
  {
    up: migration_20241214_124128.up,
    down: migration_20241214_124128.down,
    name: '20241214_124128'
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
];
