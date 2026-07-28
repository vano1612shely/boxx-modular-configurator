export const ROOM_TYPE_OPTIONS = [
  { label: 'Office', value: 'office' },
  { label: 'Classroom', value: 'classroom' },
  { label: 'Conference', value: 'conference' },
  { label: 'Kitchen', value: 'kitchen' },
  { label: 'Restroom', value: 'restroom' },
  { label: 'Lounge', value: 'lounge' },
  { label: 'Hallway', value: 'hallway' },
  { label: 'Other', value: 'other' },
] as const

export type RoomType = (typeof ROOM_TYPE_OPTIONS)[number]['value']
