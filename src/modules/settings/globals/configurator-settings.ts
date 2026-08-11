import type { Field, GlobalConfig } from 'payload'

import { PAGE_META_DEFAULTS } from '../../shared/page-meta'
import { QUIZ_COPY_DEFAULTS } from '../../shared/quiz-copy'

const OPTIONAL_LINE = 'Optional. A sentence under the question; empty shows nothing.'

function text(name: string, defaultValue: string, description?: string): Field {
  return {
    name,
    type: 'text',
    defaultValue,
    admin: description ? { description } : undefined,
  }
}

/**
 * Everything about the configurator that is not the catalogue itself.
 *
 * One page rather than several, split by tabs: an admin looking for "the words
 * on the first question" should not have to know whether we filed that under
 * display or under quiz. What the visitor chooses *between* — the building
 * lines, the sizes, the restroom counts — stays a fact about the catalogue and
 * is still read from it, so nothing typed here can offer a building that
 * cannot be built.
 */
export const ConfiguratorSettings: GlobalConfig = {
  slug: 'configurator-settings',
  label: 'Configurator',
  admin: {
    group: 'System',
    description: 'The page itself: how it is shared, what it asks, and the units it answers in.',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Page',
          description:
            'What a link to the configurator shows in a browser tab, a search result and a chat window.',
          fields: [
            {
              name: 'meta',
              type: 'group',
              label: false,
              fields: [
                text(
                  'title',
                  PAGE_META_DEFAULTS.title,
                  'The browser tab, the search result heading, and the bold line on a shared link.',
                ),
                {
                  name: 'description',
                  type: 'textarea',
                  defaultValue: PAGE_META_DEFAULTS.description,
                  admin: {
                    description:
                      'The grey line under both. Around 160 characters is what a search result shows before it trims.',
                  },
                },
                {
                  name: 'ogImage',
                  type: 'upload',
                  relationTo: 'images',
                  admin: {
                    description:
                      'The picture a shared link unfurls with. 1200 × 630 is what most places crop to; left empty, the link unfurls without one.',
                  },
                },
                {
                  name: 'favicon',
                  type: 'upload',
                  relationTo: 'images',
                  admin: {
                    description:
                      'The tab icon. A square PNG or SVG. Left empty, the app’s own icon is used.',
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'Quiz',
          description:
            'The words on the questions asked before a building is shown, and on the two screens those questions can end at.',
          fields: [
            {
              name: 'logo',
              type: 'upload',
              relationTo: 'images',
              admin: {
                description: 'Shown above the questions. Left empty, nothing stands in its place.',
              },
            },
            {
              name: 'step1',
              type: 'group',
              label: 'Step 1 — which building',
              fields: [
                text(
                  'eyebrow',
                  QUIZ_COPY_DEFAULTS.step1.eyebrow,
                  'The small line above the question.',
                ),
                text('title', QUIZ_COPY_DEFAULTS.step1.title),
                { name: 'description', type: 'textarea', admin: { description: OPTIONAL_LINE } },
                text(
                  'listLabel',
                  QUIZ_COPY_DEFAULTS.step1.listLabel,
                  'Names the list of lines for screen readers. Not shown on screen — the question above it does that job for everyone else.',
                ),
              ],
            },
            {
              name: 'step2',
              type: 'group',
              label: 'Step 2 — how much of it',
              admin: {
                description:
                  'The small line above this one is the building line the visitor just picked, so it is not set here.',
              },
              fields: [
                text('title', QUIZ_COPY_DEFAULTS.step2.title),
                { name: 'description', type: 'textarea', admin: { description: OPTIONAL_LINE } },
                {
                  type: 'row',
                  fields: [
                    text(
                      'officesLabel',
                      QUIZ_COPY_DEFAULTS.step2.officesLabel,
                      'Counter label for lines that come in offices.',
                    ),
                    text(
                      'classroomsLabel',
                      QUIZ_COPY_DEFAULTS.step2.classroomsLabel,
                      'And for lines that come in classrooms.',
                    ),
                  ],
                },
                text(
                  'overCapacityHint',
                  QUIZ_COPY_DEFAULTS.step2.overCapacityHint,
                  'Appears under the counter once the number passes the largest size on offer.',
                ),
                {
                  type: 'row',
                  fields: [
                    text('restroomsLabel', QUIZ_COPY_DEFAULTS.step2.restroomsLabel),
                    text('restroomsHint', QUIZ_COPY_DEFAULTS.step2.restroomsHint),
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    text('back', QUIZ_COPY_DEFAULTS.step2.back, 'Button back to step 1.'),
                    text('submit', QUIZ_COPY_DEFAULTS.step2.submit, 'Button into the 3D view.'),
                  ],
                },
              ],
            },
            {
              name: 'notFound',
              type: 'group',
              label: 'When the catalogue has nothing to show',
              admin: {
                description:
                  'Seen when no published building fits the answers — usually a region with an empty catalogue.',
              },
              fields: [
                text('title', QUIZ_COPY_DEFAULTS.notFound.title),
                { name: 'body', type: 'textarea', defaultValue: QUIZ_COPY_DEFAULTS.notFound.body },
              ],
            },
            {
              name: 'overCapacity',
              type: 'group',
              label: 'When the request is larger than any standard size',
              fields: [
                text(
                  'chip',
                  QUIZ_COPY_DEFAULTS.overCapacity.chip,
                  'The small badge above the heading.',
                ),
                text('title', QUIZ_COPY_DEFAULTS.overCapacity.title),
                {
                  name: 'body',
                  type: 'textarea',
                  defaultValue: QUIZ_COPY_DEFAULTS.overCapacity.body,
                  admin: {
                    description:
                      'Write {units} where the number they asked for should go, and {line} for the building line. Anything else in braces is left on screen as typed, so a misspelt name is visible rather than silently dropped.',
                  },
                },
                text(
                  'action',
                  QUIZ_COPY_DEFAULTS.overCapacity.action,
                  'Button back to the questions, with their answers still in them.',
                ),
              ],
            },
          ],
        },
        {
          label: 'Display',
          fields: [
            {
              name: 'areaUnit',
              type: 'select',
              defaultValue: 'sqft',
              required: true,
              options: [
                { label: 'Square feet (ft²)', value: 'sqft' },
                { label: 'Square metres (m²)', value: 'sqm' },
              ],
              admin: {
                description:
                  'Unit floor areas open in. A visitor can switch it for their own session, and their choice does not change this.',
              },
            },
          ],
        },
      ],
    },
  ],
}
