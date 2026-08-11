/**
 * The words the intake quiz opens with.
 *
 * One definition, used twice: as the default value of each field in the admin,
 * and as the fallback when a field has been emptied. A heading that renders
 * blank because somebody cleared a box is worse than one nobody has edited yet,
 * and two copies of these strings would have drifted the first time one changed.
 */
export const QUIZ_COPY_DEFAULTS = {
  step1: {
    eyebrow: 'Find your solution',
    title: 'What kind of building do you need?',
    description: '',
  },
  step2: {
    title: 'How much space do you need?',
    description: '',
  },
} as const

export type QuizStepCopy = {
  title: string
  description: string
}

export type QuizCopy = {
  /** Shown above the form when one is uploaded; nothing stands in for it. */
  logoUrl: string | null
  step1: QuizStepCopy & { eyebrow: string }
  step2: QuizStepCopy
}
