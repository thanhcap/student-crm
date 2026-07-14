// V9 — shared outer-space backdrop: CSS-only star field + nebula accents on a
// #06060F base. Fixed behind every marketing page so the theme lands even
// before (or without) WebGL.
export default function SpaceBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#06060F]" aria-hidden>
      {/* star layers */}
      <div className="absolute inset-0"
           style={{ background: 'radial-gradient(1px 1px at 10% 20%, white, transparent), radial-gradient(1px 1px at 40% 60%, white, transparent), radial-gradient(1px 1px at 70% 30%, white, transparent), radial-gradient(1px 1px at 85% 75%, white, transparent)',
                    backgroundSize: '400px 400px', opacity: 0.4 }} />
      <div className="absolute inset-0"
           style={{ background: 'radial-gradient(1.5px 1.5px at 25% 45%, rgba(255,255,255,0.8), transparent), radial-gradient(1px 1px at 55% 15%, rgba(255,255,255,0.6), transparent), radial-gradient(1px 1px at 90% 55%, rgba(255,255,255,0.5), transparent)',
                    backgroundSize: '600px 600px', opacity: 0.3 }} />
      {/* nebula accents — violet / cyan / gold */}
      <div className="absolute top-[10%] -left-[20%] w-[60vw] h-[60vw] rounded-full opacity-[0.07]"
           style={{ background: 'radial-gradient(circle, #8B5CF6, transparent 70%)' }} />
      <div className="absolute bottom-[5%] -right-[10%] w-[45vw] h-[45vw] rounded-full opacity-[0.05]"
           style={{ background: 'radial-gradient(circle, #06B6D4, transparent 70%)' }} />
      <div className="absolute top-[40%] left-[30%] w-[30vw] h-[30vw] rounded-full opacity-[0.04]"
           style={{ background: 'radial-gradient(circle, #F59E0B, transparent 70%)' }} />
    </div>
  );
}
