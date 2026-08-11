import type { PayloadModule } from '../types'

import { DisplaySettings } from './globals/display-settings'
import { QuizSettings } from './globals/quiz-settings'

export const settingsModule: PayloadModule = {
  globals: [QuizSettings, DisplaySettings],
}

export { DisplaySettings, QuizSettings }
