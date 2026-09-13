import { eduplexSchool } from './eduplex-school'
import type { BuildingSpec } from './types'

/**
 * EDUPlex "8 classroom" — the six-classroom school with a second middle column.
 *
 * Each size is its six-classroom counterpart with the middle column repeated
 * — 8.433 m more building — and the blocks, where it has them, standing where
 * the six-classroom sizes have them. Read off the door casings of each glb,
 * then audited against it.
 */

export const eduplex8Classroom: BuildingSpec = eduplexSchool({
  slug: 'eduplex-8-classroom',
  title: 'EDUPlex — 8 classroom',
  modelTitle: 'EDUPlex 8 classroom (client asset)',
  files: {
    main: '8classroom_horizontal_cut_-_copy.glb',
    full: '8classroom_eduplex_-_copy.glb',
  },
  columns: [
    { kind: 'west', at: 1.54 },
    { kind: 'middle', at: 1.54 },
    { kind: 'middle', at: 9.973 },
    { kind: 'east', at: 9.973 },
  ],
})

export const eduplex8ClassroomRestroom: BuildingSpec = eduplexSchool({
  slug: 'eduplex-8-classroom-restroom',
  title: 'EDUPlex — 8 classroom, restrooms',
  modelTitle: 'EDUPlex 8 classroom with restrooms (client asset)',
  files: {
    main: '8classroomrestroom_horizontal_cut_-_copy.glb',
    full: '8classroomrestroom_eduplex_-_copy.glb',
  },
  columns: [
    { kind: 'west', at: -1.243 },
    { kind: 'middle', at: -1.243 },
    { kind: 'middle', at: 10.797 },
    { kind: 'east', at: 10.797 },
  ],
  restroomBayAt: 2.364,
})

export const eduplex8ClassroomOffices: BuildingSpec = eduplexSchool({
  slug: 'eduplex-8-classroom-offices',
  title: 'EDUPlex — 8 classroom, 2 offices',
  modelTitle: 'EDUPlex 8 classroom with offices (client asset)',
  files: {
    main: '8classroomoffices_horizontal_cut_-_copy.glb',
    full: '8classroomoffices_eduplex_-_copy.glb',
  },
  columns: [
    { kind: 'west', at: 0 },
    { kind: 'middle', at: 0 },
    { kind: 'middle', at: 12.649 },
    { kind: 'east', at: 12.649 },
  ],
  officeModuleAt: 3.607,
})

export const eduplex8ClassroomRestroomOffices: BuildingSpec = eduplexSchool({
  slug: 'eduplex-8-classroom-restroom-offices',
  title: 'EDUPlex — 8 classroom, 2 offices, restrooms',
  modelTitle: 'EDUPlex 8 classroom with offices and restrooms (client asset)',
  files: {
    main: '8classroomrestroomoffices_horizontal_cut__-_copy.glb',
    full: '8classroomrestroomoffices_eduplex_-_copy.glb',
  },
  columns: [
    { kind: 'west', at: -3.607 },
    { kind: 'middle', at: -3.607 },
    { kind: 'middle', at: 12.649 },
    { kind: 'east', at: 12.649 },
  ],
  restroomBayAt: 0,
  officeModuleAt: 3.607,
})
