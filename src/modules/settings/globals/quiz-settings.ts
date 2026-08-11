import type { GlobalConfig } from 'payload'

import { QUIZ_COPY_DEFAULTS } from '../../shared/quiz-copy'

/**
 * The copy on the two screens a visitor sees before the 3D view.
 *
 * Text only. What the visitor is choosing *between* — the building lines, the
 * sizes, the restroom counts — is a fact about the catalogue and is still read
 * from it, so nothing here can put an option on screen that cannot be built.
 */
export const QuizSettings: GlobalConfig = {
  slug: 'quiz-settings',
  label: 'Quiz',
  admin: {
    group: 'System',
    description:
      'Headings on the two questions asked before the building is shown. The choices themselves come from the catalogue.',
  },
  access: {
    read: () => true,
  },
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
        {
          name: 'eyebrow',
          type: 'text',
          defaultValue: QUIZ_COPY_DEFAULTS.step1.eyebrow,
          admin: { description: 'The small line above the question.' },
        },
        {
          name: 'title',
          type: 'text',
          defaultValue: QUIZ_COPY_DEFAULTS.step1.title,
        },
        {
          name: 'description',
          type: 'textarea',
          admin: { description: 'Optional. A sentence under the question; empty shows nothing.' },
        },
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
        {
          name: 'title',
          type: 'text',
          defaultValue: QUIZ_COPY_DEFAULTS.step2.title,
        },
        {
          name: 'description',
          type: 'textarea',
          admin: { description: 'Optional. A sentence under the question; empty shows nothing.' },
        },
      ],
    },
  ],
}
