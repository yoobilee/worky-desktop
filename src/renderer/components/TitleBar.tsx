import { IconMinus, IconX } from '@tabler/icons-react'

export default function TitleBar() {
  const isWin = window.electronAPI.platform === 'win32'

  return (
    <div className="drag-region flex items-center justify-between h-8 bg-[#0d0f14] shrink-0 select-none border-b border-white/5">
      <div className="flex items-center gap-2 px-3">
        <div
          className="w-4 h-4 rounded flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}
        >
          <span className="text-white text-[9px] font-black leading-none">W</span>
        </div>
        <span className="text-[11px] font-semibold text-white/40 tracking-wide">Worky</span>
      </div>

      {isWin && (
        <div className="no-drag flex items-center h-full">
          <button
            onClick={() => window.electronAPI.windowControls.minimize()}
            className="flex items-center justify-center w-9 h-full text-white/30 hover:text-white/70 hover:bg-white/5 transition-colors"
          >
            <IconMinus size={11} />
          </button>
          <button
            onClick={() => window.electronAPI.windowControls.close()}
            className="flex items-center justify-center w-9 h-full text-white/30 hover:text-white hover:bg-red-500/80 transition-colors"
          >
            <IconX size={11} />
          </button>
        </div>
      )}
    </div>
  )
}
