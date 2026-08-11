import * as migration_20260728_081852_initial from './20260728_081852_initial';
import * as migration_20260802_230549_schema_since_initial from './20260802_230549_schema_since_initial';
import * as migration_20260803_074948_drop_line_max_units from './20260803_074948_drop_line_max_units';
import * as migration_20260803_091726_add_building_floors from './20260803_091726_add_building_floors';
import * as migration_20260803_122643_add_storey_floor_level from './20260803_122643_add_storey_floor_level';
import * as migration_20260803_232420_add_scene_floor_y from './20260803_232420_add_scene_floor_y';
import * as migration_20260806_105259_add_room_area from './20260806_105259_add_room_area';
import * as migration_20260806_200448_add_recommended_for from './20260806_200448_add_recommended_for';
import * as migration_20260806_200729_add_building_facts from './20260806_200729_add_building_facts';
import * as migration_20260810_115345_add_area_units from './20260810_115345_add_area_units';
import * as migration_20260811_074945_add_quiz_settings from './20260811_074945_add_quiz_settings';
import * as migration_20260811_075626_add_quiz_screens from './20260811_075626_add_quiz_screens';

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
    name: '20260803_122643_add_storey_floor_level',
  },
  {
    up: migration_20260803_232420_add_scene_floor_y.up,
    down: migration_20260803_232420_add_scene_floor_y.down,
    name: '20260803_232420_add_scene_floor_y',
  },
  {
    up: migration_20260806_105259_add_room_area.up,
    down: migration_20260806_105259_add_room_area.down,
    name: '20260806_105259_add_room_area',
  },
  {
    up: migration_20260806_200448_add_recommended_for.up,
    down: migration_20260806_200448_add_recommended_for.down,
    name: '20260806_200448_add_recommended_for',
  },
  {
    up: migration_20260806_200729_add_building_facts.up,
    down: migration_20260806_200729_add_building_facts.down,
    name: '20260806_200729_add_building_facts',
  },
  {
    up: migration_20260810_115345_add_area_units.up,
    down: migration_20260810_115345_add_area_units.down,
    name: '20260810_115345_add_area_units',
  },
  {
    up: migration_20260811_074945_add_quiz_settings.up,
    down: migration_20260811_074945_add_quiz_settings.down,
    name: '20260811_074945_add_quiz_settings',
  },
  {
    up: migration_20260811_075626_add_quiz_screens.up,
    down: migration_20260811_075626_add_quiz_screens.down,
    name: '20260811_075626_add_quiz_screens'
  },
];
