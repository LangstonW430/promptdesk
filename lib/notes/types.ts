export const NOTE_TYPES = ['note', 'call', 'meeting', 'email'] as const
export type NoteType = (typeof NOTE_TYPES)[number]
