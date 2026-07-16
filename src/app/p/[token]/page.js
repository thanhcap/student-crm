'use client';
// V3 F59/F60 — public proposal page: clean reading layout + canvas signature
// pad. Data comes from the proposal-public edge function (token-gated), never
// from an anon table read.
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

const FN_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/proposal-public`;

function SignaturePad({ onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c.getContext('2d');
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  }, []);

  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const t = e.touches?.[0] || e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };
  const start = (e) => { drawing.current = true; const p = pos(e); const ctx = canvasRef.current.getContext('2d'); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const p = pos(e); const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(p.x, p.y); ctx.stroke();
    dirty.current = true;
  };
  const end = () => { if (drawing.current && dirty.current) onChange(canvasRef.current.toDataURL('image/png')); drawing.current = false; };
  const clear = () => { const c = canvasRef.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); dirty.current = false; onChange(null); };

  return (
    <div>
      <canvas ref={canvasRef} width={560} height={140}
        className="w-full border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 touch-none cursor-crosshair"
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
      <button type="button" onClick={clear} className="mt-1 text-[12px] font-semibold text-gray-400 hover:text-gray-700">Clear</button>
    </div>
  );
}

export default function PublicProposal() {
  const { token } = useParams();
  const [proposal, setProposal] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | missing | signing | done
  const [signature, setSignature] = useState(null);
  const [signerName, setSignerName] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`${FN_BASE}?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => { if (d?.title) { setProposal(d); setState('ready'); } else setState('missing'); })
      .catch(() => setState('missing'));
  }, [token]);

  async function submitSignature(e) {
    e.preventDefault();
    if (!signature || !signerName.trim()) return;
    setState('signing'); setErr('');
    const r = await fetch(FN_BASE, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, signer_name: signerName, signature_data: signature }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.ok) { setState('done'); setProposal(p => ({ ...p, signed_at: new Date().toISOString(), signer_name: signerName })); }
    else { setErr(d.error || 'Could not sign — try again.'); setState('ready'); }
  }

  if (state === 'loading') return <div className="min-h-screen grid place-items-center bg-gray-50"><p className="text-[14px] text-gray-400">Loading proposal…</p></div>;
  if (state === 'missing') return <div className="min-h-screen grid place-items-center bg-gray-50"><p className="text-[14px] text-gray-500">This proposal link is invalid or no longer available.</p></div>;

  const sections = Array.isArray(proposal.sections) ? proposal.sections : [];
  const signed = !!proposal.signed_at || state === 'done';

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 print:bg-white print:py-0">
      <article className="max-w-2xl mx-auto bg-white rounded-2xl border border-gray-200 shadow-sm p-8 sm:p-12 print:border-0 print:shadow-none">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400 mb-2">Proposal</p>
        <h1 className="text-[28px] font-bold tracking-tight text-gray-900 mb-1">{proposal.title || 'Untitled proposal'}</h1>
        <p className="text-[12px] text-gray-400 mb-8">
          {proposal.valid_until ? `Valid until ${proposal.valid_until}` : ''}
          {proposal.expired && <span className="ml-2 text-red-600 font-semibold">Expired</span>}
        </p>

        {sections.map((s, i) => (
          <section key={i} className="mb-7">
            {s.heading && <h2 className="text-[16px] font-bold text-gray-900 mb-2">{s.heading}</h2>}
            <p className="text-[14px] leading-relaxed text-gray-700 whitespace-pre-wrap">{s.body}</p>
          </section>
        ))}

        <div className="mt-10 pt-6 border-t border-gray-100 print:hidden">
          {signed ? (
            <div className="rounded-xl bg-green-50 border border-green-200 p-4">
              <p className="text-[14px] font-bold text-green-800">Signed{proposal.signer_name ? ` by ${proposal.signer_name}` : ''}</p>
              <p className="text-[12px] text-green-700 mt-0.5">{proposal.signed_at ? new Date(proposal.signed_at).toLocaleString() : ''}</p>
            </div>
          ) : proposal.expired ? (
            <p className="text-[13px] text-gray-500">This proposal has expired — contact the sender for an updated version.</p>
          ) : (
            <form onSubmit={submitSignature} className="space-y-3">
              <h3 className="text-[15px] font-bold text-gray-900">Accept &amp; sign</h3>
              <input value={signerName} onChange={e => setSignerName(e.target.value)} placeholder="Your full name" required
                className="w-full px-3 py-2 text-[14px] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400" />
              <SignaturePad onChange={setSignature} />
              {err && <p className="text-[12px] text-red-600 font-medium">{err}</p>}
              <button type="submit" disabled={!signature || !signerName.trim() || state === 'signing'}
                className="px-6 py-3 text-[14px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 disabled:opacity-40">
                {state === 'signing' ? 'Signing…' : 'Sign proposal'}
              </button>
              <p className="text-[11px] text-gray-400">By signing you agree to the terms described above. A timestamp and your signature image are recorded.</p>
            </form>
          )}
        </div>
      </article>
      <p className="text-center text-[11px] text-gray-400 mt-6 print:hidden">
        <button onClick={() => window.print()} className="underline hover:text-gray-600">Print / save as PDF</button>
      </p>
    </div>
  );
}
