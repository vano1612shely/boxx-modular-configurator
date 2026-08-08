import 'dotenv/config'

import { getPayload, type Payload } from 'payload'

import { SHELL_DEFAULTS } from '@/modules/shared/room-shell'

import config from '../payload.config'
import {
  buildConferenceCorePackage,
  buildDemoBuilding,
  buildOfficeCorePackage,
} from './lib/build-demo-assets'

async function createModelFromBuffer(payload: Payload, title: string, name: string, data: Buffer) {
  return payload.create({
    collection: 'models',
    data: { title },
    file: {
      data,
      mimetype: 'model/gltf-binary',
      name,
      size: data.byteLength,
    },
  })
}

/** Dev convenience: first admin account from env, so a fresh DB is usable. */
async function ensureAdminUser(payload: Payload) {
  const email = process.env.DEV_ADMIN_EMAIL
  const password = process.env.DEV_ADMIN_PASSWORD
  if (!email || !password) return

  const users = await payload.find({ collection: 'users', limit: 1 })
  if (users.totalDocs > 0) return

  await payload.create({ collection: 'users', data: { email, password } })
  payload.logger.info(`Created dev admin ${email}.`)
}

async function seed() {
  const payload = await getPayload({ config })

  await ensureAdminUser(payload)

  const existing = await payload.find({
    collection: 'regions',
    where: { code: { equals: 'us' } },
    limit: 1,
  })

  if (existing.totalDocs > 0) {
    payload.logger.info('Base seed already present — nothing to do.')
    return
  }

  payload.logger.info('Seeding demo catalog…')

  const region = await payload.create({
    collection: 'regions',
    data: { name: 'United States', code: 'us' },
  })

  const line = await payload.create({
    collection: 'building-lines',
    data: {
      name: 'BOXXPlex (Demo)',
      slug: 'boxxplex',
      unitLabel: 'offices',
      description: 'Demo modular office complex line.',
      rules: {
        restroomsRequiredAt: 5,
        secondRestroomSetAt: 10,
      },
      regions: [region.id],
    },
  })

  const buildingModel = await createModelFromBuffer(
    payload,
    'Demo building — 2 offices',
    'demo-building-2-offices.glb',
    await buildDemoBuilding(),
  )
  const officeCoreModel = await createModelFromBuffer(
    payload,
    'Office Core package',
    'package-office-core.glb',
    await buildOfficeCorePackage(),
  )
  const conferenceCoreModel = await createModelFromBuffer(
    payload,
    'Conference Core package',
    'package-conference-core.glb',
    await buildConferenceCorePackage(),
  )

  await payload.create({
    collection: 'furniture-packages',
    data: {
      title: 'Office Core',
      family: 'office',
      tier: 'core',
      model: officeCoreModel.id,
      price: 1450,
      description: 'Desk, task chair and storage cabinet.',
      footprint: { width: 2.6, depth: 2 },
      compatibleRoomTypes: ['office'],
      recommendedFor: ['office'],
      compatibleLines: [line.id],
      regions: [region.id],
    },
  })

  await payload.create({
    collection: 'furniture-packages',
    data: {
      title: 'Conference Core',
      family: 'conference',
      tier: 'core',
      model: conferenceCoreModel.id,
      price: 2900,
      description: 'Conference table with six chairs.',
      footprint: { width: 3.4, depth: 2.9 },
      // Offered in an office too, but only recommended where it belongs — which
      // is what puts it under "More furniture" rather than at the top.
      compatibleRoomTypes: ['conference', 'office'],
      recommendedFor: ['conference'],
      compatibleLines: [line.id],
      regions: [region.id],
    },
  })

  await payload.create({
    collection: 'building-models',
    data: {
      title: 'BOXXPlex — 2 offices (Demo)',
      line: line.id,
      unitCount: 2,
      restroomCount: 0,
      sqft: 775,
      dimensions: "20' x 40'",
      occupancy: 12,
      estimatedPrice: 96500,
      leadTime: '8–10 weeks',
      model: buildingModel.id,
      regions: [region.id],
      sceneConfig: {
        camera: {
          position: { x: 10, y: 8, z: 12 },
          target: { x: 0, y: 1, z: 0 },
          fov: 50,
          minDistance: 3,
          maxDistance: 30,
          minPolarDeg: 15,
          maxPolarDeg: 85,
        },
        roofBlocks: [
          { min: { x: -6.6, y: 2.9, z: -3.6 }, max: { x: 6.6, y: 3.4, z: 3.6 } },
        ],
      },
      rooms: [
        {
          key: 'office-1',
          name: 'Office 1',
          roomType: 'office',
          // Wall sides come straight from the outline geometry; the demo rooms
          // are rectangles, so each edge is its own wall.
          floorPolygon: [
            { x: -5.9, z: -2.9, side: 'w1' },
            { x: -0.1, z: -2.9, side: 'w2' },
            { x: -0.1, z: 2.9, side: 'w3' },
            { x: -5.9, z: 2.9, side: 'w4' },
          ],
          shell: {
            floorY: 0,
            wallHeight: 3,
            wallThickness: SHELL_DEFAULTS.wallThickness,
            floorThickness: SHELL_DEFAULTS.floorThickness,
            ceilingThickness: SHELL_DEFAULTS.ceilingThickness,
            sideAxes: null,
          },
          openings: [],
          cameraPreset: { position: { x: -3, y: 4.5, z: 6 }, target: { x: -3, y: 0.8, z: 0 } },
        },
        {
          key: 'office-2',
          name: 'Office 2',
          roomType: 'office',
          // Wall sides come straight from the outline geometry; the demo rooms
          // are rectangles, so each edge is its own wall.
          floorPolygon: [
            { x: 0.1, z: -2.9, side: 'w1' },
            { x: 5.9, z: -2.9, side: 'w2' },
            { x: 5.9, z: 2.9, side: 'w3' },
            { x: 0.1, z: 2.9, side: 'w4' },
          ],
          shell: {
            floorY: 0,
            wallHeight: 3,
            wallThickness: SHELL_DEFAULTS.wallThickness,
            floorThickness: SHELL_DEFAULTS.floorThickness,
            ceilingThickness: SHELL_DEFAULTS.ceilingThickness,
            sideAxes: null,
          },
          openings: [],
          cameraPreset: { position: { x: 3, y: 4.5, z: 6 }, target: { x: 3, y: 0.8, z: 0 } },
        },
      ],
    },
  })


  payload.logger.info('Seed complete.')
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
