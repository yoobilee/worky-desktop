import { IconBriefcase } from '@tabler/icons-react'

export default function App() {
  return (
    <div className="h-full w-full bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-indigo-600 p-4 rounded-2xl">
            <IconBriefcase size={48} color="white" />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-white mb-3">
          Hello Worky Desktop
        </h1>
        <p className="text-slate-400 text-lg">
          Electron + React + TypeScript + Vite
        </p>
        <div className="mt-8 flex gap-3 justify-center">
          <span className="bg-slate-800 text-slate-300 px-3 py-1 rounded-full text-sm">
            Supabase Ready
          </span>
          <span className="bg-slate-800 text-slate-300 px-3 py-1 rounded-full text-sm">
            Tailwind CSS
          </span>
          <span className="bg-slate-800 text-slate-300 px-3 py-1 rounded-full text-sm">
            Tabler Icons
          </span>
        </div>
      </div>
    </div>
  )
}
