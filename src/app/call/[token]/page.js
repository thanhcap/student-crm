'use client';
// A-2 — the join side of a call. The person receiving the link is the answerer
// (isInitiator=false); the CRM user who started the call is the offerer.
//
// Signaling is Supabase Realtime broadcast on `call:<room_token>`. The room
// token is unguessable and the page asks for camera/mic only after an explicit
// click, so nobody's webcam turns on from a link preview.
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { VideoCallRoom } from '../../components/MediaCapture';

export default function JoinCallPage() {
  const { token } = useParams();
  const router = useRouter();
  const [joined, setJoined] = useState(false);
  const [ended, setEnded] = useState(false);

  if (ended) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-3 p-4">
        <p className="text-white text-[16px] font-semibold">Call ended.</p>
        <button type="button" onClick={() => router.push('/')}
          className="px-5 py-2.5 bg-white/15 hover:bg-white/25 text-white rounded-full text-[13px] font-semibold">
          Close
        </button>
      </div>
    );
  }

  if (joined) {
    return <VideoCallRoom roomToken={token} isInitiator={false} onEnd={() => { setJoined(false); setEnded(true); }} />;
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 p-4 text-center">
      <div>
        <p className="text-white text-[18px] font-semibold mb-1">You’ve been invited to a call.</p>
        <p className="text-white/50 text-[13px]">Your camera and microphone turn on only after you join.</p>
      </div>
      <button type="button" onClick={() => setJoined(true)}
        className="px-6 py-3 bg-white text-gray-900 rounded-full text-[14px] font-bold hover:bg-gray-200">
        Join call
      </button>
      <p className="text-white/30 text-[11px] max-w-sm">
        Connects directly between the two browsers. Some corporate or symmetric-NAT networks
        block direct connections — if it won’t connect, try a different network.
      </p>
    </div>
  );
}
