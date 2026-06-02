import type { TagColor } from './validators'

/** Tailwind classes applied to a tag chip based on its color field. */
export const TAG_COLOR_CLASSES: Record<TagColor | string, string> = {
  gray:   'bg-gray-100   text-gray-700   dark:bg-gray-800      dark:text-gray-300',
  red:    'bg-red-100    text-red-700    dark:bg-red-950/50    dark:text-red-400',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400',
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400',
  green:  'bg-green-100  text-green-700  dark:bg-green-950/50  dark:text-green-400',
  teal:   'bg-teal-100   text-teal-700   dark:bg-teal-950/50   dark:text-teal-400',
  blue:   'bg-blue-100   text-blue-700   dark:bg-blue-950/50   dark:text-blue-400',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400',
  pink:   'bg-pink-100   text-pink-700   dark:bg-pink-950/50   dark:text-pink-400',
}

/** Dot color for the color picker circles. */
export const TAG_DOT_CLASSES: Record<TagColor | string, string> = {
  gray:   'bg-gray-400',
  red:    'bg-red-500',
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-400',
  green:  'bg-green-500',
  teal:   'bg-teal-500',
  blue:   'bg-blue-500',
  violet: 'bg-violet-500',
  pink:   'bg-pink-500',
}
