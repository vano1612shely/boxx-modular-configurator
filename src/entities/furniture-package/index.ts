export type { FurniturePackageEntity, PackageFootprint } from './model/types'
export { mapFurniturePackage } from './lib/map-package'
export { MAX_SPANS, shapesCollide, type PackageShape } from './model/shape'
export {
  hasShape,
  linkPackageShape,
  measureShape,
  setMeasuredShape,
  shapeOf,
} from './lib/measured-shapes'
export { footprintOf, setMeasuredFootprint } from './lib/measured-footprints'
export { PackageModel, useCentredPackage, type CentredPackage } from './ui/PackageModel'
