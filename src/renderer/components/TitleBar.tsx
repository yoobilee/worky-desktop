import { IconMinus, IconX } from '@tabler/icons-react'

export default function TitleBar() {
  const isWin = window.electronAPI.platform === 'win32'

  return (
    <div className="drag-region flex items-center justify-between h-7 shrink-0 select-none border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-1.5 px-3">
        <div
          className="w-3.5 h-3.5 rounded flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}
        >
          <span className="text-white text-[8px] font-black leading-none">W</span>
        </div>
        <span className="text-[10px] font-semibold text-white/25 tracking-widest uppercase">Worky</span>
      </div>

      {isWin && (
        <div className="no-drag flex items-center h-full">
          <button
            onClick={() => window.electronAPI.windowControls.minimize()}
            className="flex items-center justify-center w-8 h-full text-white/25 hover:text-white/60 hover:bg-white/5 transition-colors"
          >
            <IconMinus size={10} />
          </button>
          <button
            onClick={() => window.electronAPI.windowControls.close()}
            className="flex items-center justify-center w-8 h-full text-white/25 hover:text-white hover:bg-red-500/70 transition-colors"
          >
            <IconX size={10} />
          </button>
        </div>
      )}
    </div>
  )
}
