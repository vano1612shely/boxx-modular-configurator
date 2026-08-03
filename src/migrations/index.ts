import * as migration_20260728_081852_initial from './20260728_081852_initial';
import * as migration_20260802_230549_schema_since_initial from './20260802_230549_schema_since_initial';
import * as migration_20260803_074948_drop_line_max_units from './20260803_074948_drop_line_max_units';
import * as migration_20260803_091726_add_building_floors from './20260803_091726_add_building_floors';
import * as migration_20260803_122643_add_storey_floor_level from './20260803_122643_add_storey_floor_level';

export const migrations = [
  {
    up: migration_20260728_081852_initial.up,
    down: migration_20260728_081852_initial.down,
    name: '20260728_081852_initial',
  },
  {
    up: migration_20260802_230549_schema_since_initial.up,
    down: migration_20260802_230549_schema_since_initial.down,
    name: '20260802_230549_schema_since_initial',
  },
  {
    up: migration_20260803_074948_drop_line_max_units.up,
    down: migration_20260803_074948_drop_line_max_units.down,
    name: '20260803_074948_drop_line_max_units',
  },
  {
    up: migration_20260803_091726_add_building_floors.up,
    down: migration_20260803_091726_add_building_floors.down,
    name: '20260803_091726_add_building_floors',
  },
  {
    up: migration_20260803_122643_add_storey_floor_level.up,
    down: migration_20260803_122643_add_storey_floor_level.down,
    name: '20260803_122643_add_storey_floor_level'
  },
];
