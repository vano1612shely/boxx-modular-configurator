/**
 * The slice's server entry — see `entities/building/api/index.ts` for why the
 * two halves are separate. In short: this half imports `@payload-config`, and
 * the other half is drawn in the browser.
 */
export { getPackagesByIds, getPackagesForLine } from './get-packages'
