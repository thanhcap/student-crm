// V9 — Logo system. The mark is a glow-ringed circle designed so the founder can
// later drop a face photo in: replace the initials <span> with
// <img src="/logo-face.png" className="w-full h-full object-cover" alt="" />
// and regenerate /public/favicon from the same source.
export function LogoMark({ size = 40, className = '' }) {
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}
         style={{ width: size, height: size }}>
      {/* glow ring */}
      <div className="absolute inset-0 rounded-full"
           style={{ background: 'conic-gradient(from 180deg, #8B5CF6, #06B6D4, #F59E0B, #8B5CF6)',
                    filter: 'blur(6px)', opacity: 0.5, transform: 'scale(1.15)' }} />
      {/* main circle — PLACEHOLDER initials; swap for the founder photo later */}
      <div className="relative w-full h-full rounded-full bg-[#0A0A1A] border border-white/10
                      flex items-center justify-center overflow-hidden">
        <span className="text-white font-bold" style={{ fontSize: size * 0.38 }}>RC</span>
      </div>
    </div>
  );
}

export function LogoFull({ className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={32} />
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-white">Relationship CRM</span>
    </div>
  );
}
