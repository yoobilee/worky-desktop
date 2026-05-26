import { supabase } from './supabase'
import type { Client, DbClient, ReportStatus } from '../types'

function normalize(raw: Record<string, unknown>): Client {
  let status = (raw.status as string) ?? ''
  if (!['pending', 'inprogress', 'complete', 'stopped'].includes(status)) status = 'pending'
  return {
    id: (raw.id as string) ?? crypto.randomUUID(),
    name: (raw.name as string) ?? '',
    status: status as ReportStatus,
    contact: (raw.contact as string) ?? '',
    phone: (raw.phone as string) ?? '',
    link: (raw.link as string) ?? '',
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    contractStart: (raw.contractStart as string) ?? '',
    contractDays: (raw.contractDays as number) ?? null,
    reportTone: (raw.reportTone as string) ?? '',
    memo: (raw.memo as string) ?? '',
    statusHistory: Array.isArray(raw.statusHistory)
      ? (raw.statusHistory as { date: string; status: ReportStatus }[])
      : [],
    dailyLog: (raw.dailyLog as Record<string, 'done' | 'failed'>) ?? {},
    showGrassGrid: (raw.showGrassGrid as boolean) ?? false,
    createdAt: (raw.createdAt as number) ?? Date.now(),
    kakaoChat: (raw.kakaoChat as string) ?? '',
    reportTemplate: (raw.reportTemplate as string) ?? '',
  }
}

export function dbToClient(row: DbClient): Client {
  return normalize({
    id: row.id,
    name: row.name,
    status: row.status,
    contact: row.contact_person,
    phone: row.phone,
    link: row.link,
    tags: row.tags,
    contractStart: row.contract_start ?? '',
    contractDays: row.contract_days,
    reportTone: row.report_tone ?? '',
    memo: row.memo,
    statusHistory: row.history,
    dailyLog: row.progress as Record<string, 'done' | 'failed'>,
    showGrassGrid: row.show_grass_grid,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    kakaoChat: row.kakao_chat_name ?? '',
    reportTemplate: row.report_template ?? '',
  })
}

export async function fetchClients(userId: string): Promise<Client[]> {
  const { data } = await supabase
    .from('clients')
    .select(
      'id, name, status, contact_person, phone, link, tags, contract_start, contract_days, report_tone, memo, history, progress, show_grass_grid, created_at, kakao_chat_name, report_template',
    )
    .eq('user_id', userId)
    .order('created_at')
  return ((data as DbClient[]) ?? []).map(dbToClient)
}

export async function updateClientStatus(id: string, status: ReportStatus, history: unknown[]): Promise<void> {
  await supabase.from('clients').update({ status, history }).eq('id', id)
}

export async function updateKakaoChat(id: string, kakaoChat: string): Promise<void> {
  await supabase.from('clients').update({ kakao_chat_name: kakaoChat || null }).eq('id', id)
}

export async function updateReportTemplate(id: string, template: string): Promise<void> {
  await supabase.from('clients').update({ report_template: template || null }).eq('id', id)
}
