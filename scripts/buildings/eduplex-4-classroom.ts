import { eduplexSchool } from './eduplex-school'
import type { BuildingSpec } from './types'

/**
 * EDUPlex "4 classroom" — the six-classroom school with its middle pair taken out.
 *
 * Each size is its six-classroom counterpart minus the middle column — a
 * classroom and a partition, 8.433 m — with the corner columns closed up over
 * the gap and the whole file standing at its own place along x. Read off the
 * door casings of each glb, then audited against it.
 */

export const eduplex4Classroom: BuildingSpec = eduplexSchool({
  slug: 'eduplex-4-classroom',
  title: 'EDUPlex — 4 classroom',
  modelTitle: 'EDUPlex 4 classroom (client asset)',
  files: {
    main: '4classroom_horizontal_cut_eduplex_-_copy.glb',
    full: '4classroom_eduplex_-_copy.glb',
  },
  columns: [
    { kind: 'west', at: 8.377 },
    { kind: 'east', at: -0.056 },
  ],
})

export const eduplex4ClassroomRestroom: BuildingSpec = eduplexSchool({
  slug: 'eduplex-4-classroom-restroom',
  title: 'EDUPlex — 4 classroom, restrooms',
  modelTitle: 'EDUPlex 4 classroom with restrooms (client asset)',
  files: {
    main: '4classroomrestroom_horizontal_cut_eduplex_-_copy.glb',
    full: '4_classroomrestroom_eduplex_-_copy.glb',
  },
  columns: [
    { kind: 'west', at: 4.826 },
    { kind: 'east', at: 0 },
  ],
  restroomBayAt: 0,
})

export const eduplex4ClassroomOffices: BuildingSpec = eduplexSchool({
  slug: 'eduplex-4-classroom-offices',
  title: 'EDUPlex — 4 classroom, 2 offices',
  modelTitle: 'EDUPlex 4 classroom with offices (client asset)',
  files: {
    main: '4classroomoffices_horizontal_cut_eduplex_-_copy.glb',
    full: '4classroomoffices_eduplex_-_copy.glb',
  },
  columns: [
    { kind: 'west', at: 8.433 },
    { kind: 'east', at: 4.217 },
  ],
  officeModuleAt: 3.607,
})

export const eduplex4ClassroomRestroomOffices: BuildingSpec = eduplexSchool({
  slug: 'eduplex-4-classroom-restroom-offices',
  title: 'EDUPlex — 4 classroom, 2 offices, restrooms',
  modelTitle: 'EDUPlex 4 classroom with offices and restrooms (client asset)',
  files: {
    main: '4classroomrestroomoffices_horizontal_cut_-_copy.glb',
    full: '4classroomrestroomoffices_eduplex_-_copy.glb',
  },
  columns: [
    { kind: 'west', at: 4.826 },
    { kind: 'east', at: 4.216 },
  ],
  restroomBayAt: 0,
  officeModuleAt: 3.607,
})
