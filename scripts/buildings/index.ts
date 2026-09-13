import type { BuildingSpec } from './types'

import { boxxplex5Section } from './boxxplex-5-section'
import {
  boxxplex2Section,
  boxxplex3Section,
  boxxplex4Section,
  boxxplex6Section,
  boxxplex6SectionTwoRestrooms,
  boxxplex7Section,
  boxxplex8Section,
  boxxplex9Section,
} from './boxxplex-sizes'
import {
  eduplex4Classroom,
  eduplex4ClassroomOffices,
  eduplex4ClassroomRestroom,
  eduplex4ClassroomRestroomOffices,
} from './eduplex-4-classroom'
import {
  eduplex8Classroom,
  eduplex8ClassroomOffices,
  eduplex8ClassroomRestroom,
  eduplex8ClassroomRestroomOffices,
} from './eduplex-8-classroom'
import {
  eduplex10Classroom,
  eduplex10ClassroomOffices,
  eduplex10ClassroomRestroom,
  eduplex10ClassroomRestroomOffices,
} from './eduplex-10-classroom'
import { eduplex6Classroom } from './eduplex-6-classroom'
import {
  mobileOffice10x36,
  mobileOffice12x46,
  mobileOffice12x46Britco,
  mobileOffice12x56,
} from './mobile-offices'
import { eduplex6ClassroomOffices } from './eduplex-6-classroom-offices'
import { eduplex6ClassroomRestroom } from './eduplex-6-classroom-restroom'
import { eduplex6ClassroomRestroomOffices } from './eduplex-6-classroom-restroom-offices'

/**
 * Every building the importer knows, by the slug you pass it.
 *
 * The five-section building comes first because the others take their
 * textures, door and window from it — import it before them on a fresh
 * database, or their lookups have nothing to find.
 */
export const SPECS: Record<string, BuildingSpec> = Object.fromEntries(
  [
    boxxplex5Section,
    boxxplex6Section,
    boxxplex6SectionTwoRestrooms,
    boxxplex7Section,
    boxxplex8Section,
    boxxplex9Section,
    boxxplex4Section,
    boxxplex3Section,
    boxxplex2Section,
    eduplex6Classroom,
    eduplex6ClassroomRestroom,
    eduplex6ClassroomOffices,
    eduplex6ClassroomRestroomOffices,
    eduplex4Classroom,
    eduplex4ClassroomRestroom,
    eduplex4ClassroomOffices,
    eduplex4ClassroomRestroomOffices,
    eduplex8Classroom,
    eduplex8ClassroomRestroom,
    eduplex8ClassroomOffices,
    eduplex8ClassroomRestroomOffices,
    eduplex10Classroom,
    eduplex10ClassroomRestroom,
    eduplex10ClassroomOffices,
    eduplex10ClassroomRestroomOffices,
    mobileOffice12x56,
    mobileOffice12x46,
    mobileOffice12x46Britco,
    mobileOffice10x36,
  ].map((spec) => [
    spec.slug,
    spec,
  ]),
)

export type { BuildingSpec } from './types'
