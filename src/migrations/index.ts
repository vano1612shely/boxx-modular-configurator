import * as migration_20260913_115750_baseline from './20260913_115750_baseline';

export const migrations = [
  {
    up: migration_20260913_115750_baseline.up,
    down: migration_20260913_115750_baseline.down,
    name: '20260913_115750_baseline'
  },
];
