import type { CollectionConfig, GlobalConfig } from 'payload'

import type { PayloadModule } from './types'

import { buildingsModule } from './buildings'
import { furnitureModule } from './furniture'
import { mediaModule } from './media'
import { quotesModule } from './quotes'
import { regionsModule } from './regions'
import { settingsModule } from './settings'
import { usersModule } from './users'

// Order matters: Payload groups the admin nav by first appearance.
const modules: PayloadModule[] = [
  regionsModule,
  buildingsModule,
  furnitureModule,
  quotesModule,
  mediaModule,
  settingsModule,
  usersModule,
]

export const collections: CollectionConfig[] = modules.flatMap((m) => m.collections ?? [])
export const globals: GlobalConfig[] = modules.flatMap((m) => m.globals ?? [])

export type { PayloadModule } from './types'
