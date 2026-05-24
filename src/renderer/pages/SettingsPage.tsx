import { IconSettings } from '@tabler/icons-react'

export default function SettingsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-slate-600">
      <IconSettings size={40} className="mb-3" />
      <p className="text-sm font-medium text-slate-500">설정</p>
      <p className="text-xs text-slate-600 mt-1">준비 중입니다</p>
    </div>
  )
}
