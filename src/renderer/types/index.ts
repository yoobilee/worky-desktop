export type ReportStatus = 'pending' | 'inprogress' | 'complete' | 'stopped'

export interface Client {
  id: string
  name: string
  status: ReportStatus
  contact: string
  phone: string
  link: string
  tags: string[]
  contractStart: string
  contractDays: number | null
  reportTone: string
  memo: string
  statusHistory: { date: string; status: ReportStatus }[]
  dailyLog: Record<string, 'done' | 'failed'>
  showGrassGrid: boolean
  createdAt: number
  kakaoChat: string
  reportTemplate: string
  groupName: string
}

export interface DbClient {
  id: string
  name: string
  status: string
  contact_person: string
  phone: string
  link: string
  tags: string[]
  contract_start: string | null
  contract_days: number | null
  report_tone: string
  memo: string
  history: unknown[]
  progress: Record<string, string>
  show_grass_grid: boolean
  created_at: string
  kakao_chat_name: string | null
  report_template: string | null
  group_name: string | null
}

export type SortOrder = 'inprogress' | 'pending' | 'expiry' | 'name'

export type Page = 'clients' | 'settings'
