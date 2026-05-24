import { IconMinus, IconSquare, IconX } from '@tabler/icons-react'

export default function TitleBar() {
  const isWin = window.electronAPI.platform === 'win32'

  return (
    <div className="drag-region flex items-center justify-between h-9 bg-slate-900 border-b border-slate-800 shrink-0 select-none">
      <div className="flex items-center gap-2 px-4">
        <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6C63FF, #8B85FF)' }}>
          <span className="text-white text-[10px] font-black leading-none">W</span>
        </div>
        <span className="text-xs font-semibold text-slate-400">Worky Desktop</span>
      </div>

      {isWin && (
        <div className="no-drag flex items-center h-full">
          <button
            onClick={() => window.electronAPI.windowControls.minimize()}
            className="flex items-center justify-center w-11 h-full text-slate-400 hover:bg-slate-700 hover:text-slate-100 transition-colors"
          >
            <IconMinus size={12} />
          </button>
          <button
            onClick={() => window.electronAPI.windowControls.maximize()}
            className="flex items-center justify-center w-11 h-full text-slate-400 hover:bg-slate-700 hover:text-slate-100 transition-colors"
          >
            <IconSquare size={11} />
          </button>
          <button
            onClick={() => window.electronAPI.windowControls.close()}
            className="flex items-center justify-center w-11 h-full text-slate-400 hover:bg-red-500 hover:text-white transition-colors"
          >
            <IconX size={13} />
          </button>
        </div>
      )}
    </div>
  )
}
