import * as migration_20260728_081852_initial from './20260728_081852_initial';
import * as migration_20260802_230549_schema_since_initial from './20260802_230549_schema_since_initial';

export const migrations = [
  {
    up: migration_20260728_081852_initial.up,
    down: migration_20260728_081852_initial.down,
    name: '20260728_081852_initial',
  },
  {
    up: migration_20260802_230549_schema_since_initial.up,
    down: migration_20260802_230549_schema_since_initial.down,
    name: '20260802_230549_schema_since_initial'
  },
];
