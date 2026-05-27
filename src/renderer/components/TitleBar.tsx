import { IconMinus, IconX } from '@tabler/icons-react'
import { useDark } from '../hooks/useDark'

export default function TitleBar() {
  const isWin = window.electronAPI.platform === 'win32'
  const dark = useDark()

  const textColor = dark ? 'rgba(255,255,255,0.25)' : 'rgba(26,26,46,0.5)'
  const hoverBg   = dark ? 'rgba(255,255,255,0.05)' : 'rgba(26,26,46,0.06)'
  const borderColor = dark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,46,0.08)'

  return (
    <div
      className="drag-region flex items-center justify-between h-7 shrink-0 select-none border-b"
      style={{ borderColor }}
    >
      <div className="flex items-center gap-1.5 px-3">
        <div
          className="w-3.5 h-3.5 rounded flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #6C63FF, #9B8FFF)' }}
        >
          <span className="text-white text-[8px] font-black leading-none">W</span>
        </div>
        <span
          className="text-[10px] font-semibold tracking-widest uppercase"
          style={{ color: textColor }}
        >
          WORKY mini
        </span>
      </div>

      {isWin && (
        <div className="no-drag flex items-center h-full">
          <button
            onClick={() => window.electronAPI.windowControls.minimize()}
            className="flex items-center justify-center w-8 h-full transition-colors"
            style={{ color: textColor }}
            onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; e.currentTarget.style.color = dark ? 'rgba(255,255,255,0.65)' : 'rgba(26,26,46,0.8)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = textColor }}
          >
            <IconMinus size={10} />
          </button>
          <button
            onClick={() => window.electronAPI.windowControls.close()}
            className="flex items-center justify-center w-8 h-full transition-colors"
            style={{ color: textColor }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.75)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = textColor }}
          >
            <IconX size={10} />
          </button>
        </div>
      )}
    </div>
  )
}
