import { eduplexSchool } from './eduplex-school'
import type { BuildingSpec } from './types'

/**
 * EDUPlex "10 classroom" — the six-classroom school with two more middle columns.
 *
 * Read off the door casings of each glb, then audited against it — see the
 * eight-classroom file for how a size is made.
 */

export const eduplex10Classroom: BuildingSpec = eduplexSchool({
  slug: 'eduplex-10-classroom',
  title: 'EDUPlex — 10 classroom',
  modelTitle: 'EDUPlex 10 classroom (client asset)',
  files: {
    main: '10classroom_horizontal_cut_eduplex_-_copy.glb',
    full: '10classroom_eduplex_-_copy.glb',
  },
  columns: [
    { kind: 'west', at: 4.216 },
    { kind: 'middle', at: 4.216 },
    { kind: 'middle', at: 12.649 },
    { kind: 'middle', at: 21.082 },
    { kind: 'east', at: 21.082 },
  ],
})

export const eduplex10ClassroomRestroom: BuildingSpec = eduplexSchool({
  slug: 'eduplex-10-classroom-restroom',
  title: 'EDUPlex — 10 classroom, restrooms',
  modelTitle: 'EDUPlex 10 classroom with restrooms (client asset)',
  files: {
    main: '10classroomrestroom_horizontal_cut_-_copy.glb',
    full: '10classroomrestroom_eduplex_-_copy.glb',
  },
  columns: [
    { kind: 'west', at: -3.607 },
    { kind: 'middle', at: -3.607 },
    { kind: 'middle', at: 8.433 },
    { kind: 'middle', at: 16.866 },
    { kind: 'east', at: 16.866 },
  ],
  restroomBayAt: 0,
})

export const eduplex10ClassroomOffices: BuildingSpec = eduplexSchool({
  slug: 'eduplex-10-classroom-offices',
  title: 'EDUPlex — 10 classroom, 2 offices',
  modelTitle: 'EDUPlex 10 classroom with offices (client asset)',
  files: {
    main: '10classroomoffices_horizontal_cut_-_copy.glb',
    full: '10classroomoffices_eduplex_-_copy.glb',
  },
  columns: [
    { kind: 'west', at: 0 },
    { kind: 'middle', at: 0 },
    { kind: 'middle', at: 12.649 },
    { kind: 'middle', at: 21.082 },
    { kind: 'east', at: 21.082 },
  ],
  officeModuleAt: 3.607,
})

export const eduplex10ClassroomRestroomOffices: BuildingSpec = eduplexSchool({
  slug: 'eduplex-10-classroom-restroom-offices',
  title: 'EDUPlex — 10 classroom, 2 offices, restrooms',
  modelTitle: 'EDUPlex 10 classroom with offices and restrooms (client asset)',
  files: {
    main: '10classroomrestroomoffices_horizontal_cut_-_copy.glb',
    full: '10classroomrestroomoffices_eduplex_-_copy.glb',
  },
  columns: [
    { kind: 'west', at: -3.607 },
    { kind: 'middle', at: -3.607 },
    { kind: 'middle', at: 12.649 },
    { kind: 'middle', at: 21.082 },
    { kind: 'east', at: 21.082 },
  ],
  restroomBayAt: 0,
  officeModuleAt: 3.607,
})
