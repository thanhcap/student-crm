'use client';
// A-1 — public video message viewer.
//
// Deliberately mirrors the /p/[token] proposal page: the data comes from a
// token-gated edge function, never from an anon table read. The bucket is
// private, so the playable URL is signed server-side with the service role and
// expires in an hour. This page never sees storage_path.
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const FN_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/video-public`;

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export default function PublicVideoMessage() {
  const { token } = useParams();
  const [state, setState] = useState('loading'); // loading | ready | missing | error
  const [video, setVideo] = useState(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${FN_BASE}?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (r.status === 404) { setState('missing'); return; }
        if (!r.ok || !body.url) { setState('error'); return; }
        setVideo(body);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, [token]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      {state === 'loading' && <p className="text-white/50 text-[13px]">Loading video…</p>}

      {state === 'missing' && (
        <div className="text-center">
          <p className="text-white text-[16px] font-semibold mb-1">This video isn’t available.</p>
          <p className="text-white/50 text-[13px]">The link may have been removed or mistyped.</p>
        </div>
      )}

      {state === 'error' && (
        <p className="text-white/60 text-[13px]">Something went wrong loading this video. Try refreshing.</p>
      )}

      {state === 'ready' && video && (
        <div className="w-full max-w-2xl">
          <video src={video.url} controls autoPlay playsInline className="w-full rounded-xl bg-black" />
          <p className="mt-3 text-center text-white/40 text-[12px]">
            {formatTime(video.duration_seconds)}
            {video.created_at ? ` · recorded ${new Date(video.created_at).toLocaleDateString()}` : ''}
          </p>
        </div>
      )}
    </div>
  );
}
