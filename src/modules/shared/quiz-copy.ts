/**
 * Every word on the screens a visitor sees before the 3D view.
 *
 * One definition, used twice: as the default value of each field in the admin,
 * and as the fallback when a field has been emptied. A heading that renders
 * blank because somebody cleared a box is worse than one nobody has edited yet,
 * and two copies of these strings would have drifted the first time one changed.
 *
 * Descriptions are the exception: they have no default, and empty is the answer
 * that hides them.
 */
export const QUIZ_COPY_DEFAULTS = {
  step1: {
    eyebrow: 'Find your solution',
    title: 'What kind of building do you need?',
    description: '',
    listLabel: 'Building line',
  },
  step2: {
    title: 'How much space do you need?',
    description: '',
    officesLabel: 'Offices',
    classroomsLabel: 'Classrooms',
    overCapacityHint: 'Beyond the largest standard size — we’ll quote it as a custom build.',
    restroomsLabel: 'Restrooms',
    restroomsHint: 'We’ll pick the closest model that covers it.',
    back: 'Back',
    submit: 'Show my building',
  },
  notFound: {
    title: 'Nothing to configure yet',
    body: 'No buildings are available for this selection right now. Please try again shortly.',
  },
  overCapacity: {
    chip: 'Custom build',
    title: 'That’s a big project — we like it.',
    body: '{units} units is beyond the largest standard {line} configuration. Our team will put together an individual proposal for you.',
    action: 'Adjust request',
  },
} as const

/**
 * Fills `{name}` slots in an admin-written sentence.
 *
 * The over-capacity screen has to name a figure and a building line that only
 * exist at the moment it is shown, so its wording cannot be plain text without
 * losing them. A slot nobody supplied is left standing rather than blanked —
 * a typo should read as a typo, not quietly delete the rest of the meaning.
 */
export function fillTokens(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? values[name] : whole,
  )
}

export type QuizCopy = {
  /** Shown above the questions when one is uploaded; nothing stands in for it. */
  logoUrl: string | null
  step1: {
    eyebrow: string
    title: string
    description: string
    listLabel: string
  }
  step2: {
    title: string
    description: string
    officesLabel: string
    classroomsLabel: string
    overCapacityHint: string
    restroomsLabel: string
    restroomsHint: string
    back: string
    submit: string
  }
  notFound: {
    title: string
    body: string
  }
  overCapacity: {
    chip: string
    title: string
    /** Carries `{units}` and `{line}`. */
    body: string
    action: string
  }
}
