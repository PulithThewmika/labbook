// Mirrors backend/types.bal and docs/api.md.

export interface Me {
  id: string
  email: string | null
  displayName: string
  role: 'student' | 'admin'
}

export interface Lab {
  id: string
  code: string
  name: string
  building: string
  room: string
  capacity: number
  description: string
  openTime: string
  closeTime: string
  isActive: boolean
}

export type LabInput = Omit<Lab, 'id'>

export type EquipmentStatus = 'available' | 'maintenance' | 'retired'

export interface Equipment {
  id: string
  labId: string | null
  labCode: string | null
  assetTag: string
  name: string
  category: string
  description: string
  status: EquipmentStatus
}

export type EquipmentInput = Pick<Equipment, 'labId' | 'assetTag' | 'name' | 'category' | 'description' | 'status'>

export interface LabDetail extends Lab {
  equipment: Equipment[]
}

export type BookingStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed' | 'expired'

export interface BusySlot {
  startAt: string
  endAt: string
  status: string
}

export interface Availability {
  openTime: string
  closeTime: string
  busy: BusySlot[]
}

export interface Booking {
  id: string
  userId: string
  userName: string
  resourceType: 'lab' | 'equipment'
  resourceId: string
  resourceName: string
  startAt: string
  endAt: string
  purpose: string
  attendees: number
  status: BookingStatus
  adminNote: string | null
  decidedAt: string | null
  createdAt: string
}

export interface BookingInput {
  resourceType: 'lab' | 'equipment'
  resourceId: string
  startAt: string
  endAt: string
  purpose: string
  attendees: number
}

export interface Stats {
  bookingsToday: number
  pendingCount: number
  labUtilisation7d: { labId: string; code: string; hoursBooked: number; hoursOpen: number; ratio: number }[]
  topEquipment30d: { id: string; name: string; count: number }[]
}
