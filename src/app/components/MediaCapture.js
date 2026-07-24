'use client';
// ============================================================================
// MEDIA CAPTURE ROUND A — every browser-media surface in one module.
//   A-1 VideoMessageRecorder   screen+audio capture -> private bucket -> /v/<token>
//   A-2 VideoCallRoom          WebRTC over Supabase Realtime broadcast signaling
//   A-3 AudioRecorderWithNotes mic capture with timestamped moment tags
//       RecordingPlayback      click a note to seek to that exact offset
//   A-4 VoiceMemoRecorder      same capture, no tagging
//   A-6 BusinessCardScanner    Tesseract.js OCR, entirely client-side
//
// Storage contract: every upload path MUST begin with the caller's own auth
// uid, because the `media` bucket's RLS policy matches on the first path
// segment. `${user.id}/video-messages/x.webm` — never a bare filename.
//
// The bucket is private. Playback inside the app uses a short-lived signed URL
// created with the user's own session (they own the object). Public playback
// goes through the `video-public` edge function, which signs with the service
// role — the client never sees storage_path for a video it doesn't own.
// ============================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';

const inputCls =
  'w-full px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 rounded-lg focus:outline-none focus:border-gray-400';

const btnBase =
  'px-4 py-2 text-[13px] font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const BTN = {
  primary: `${btnBase} text-white dark:text-gray-900 bg-gray-900 dark:bg-white hover:bg-gray-700 dark:hover:bg-gray-200`,
  ghost: `${btnBase} text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800`,
  danger: `${btnBase} text-white bg-red-600 hover:bg-red-700`,
};

function Button({ variant = 'primary', className = '', ...p }) {
  return <button type="button" className={`${BTN[variant] || BTN.primary} ${className}`} {...p} />;
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">{label}</span>
      {children}
    </label>
  );
}

// mm:ss for anything under an hour, h:mm:ss beyond it.
export function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function formatRelativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// Short, collision-resistant share/room token. crypto.randomUUID is available
// in every browser that can do getDisplayMedia, but keep a fallback anyway.
export function mediaToken(prefix) {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '')
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix ? `${prefix}_${rand.slice(0, 24)}` : rand.slice(0, 32);
}

// MediaRecorder mimeType support varies (Safari has no vp9). Pick the first
// candidate the browser actually claims to support, else let it choose.
function pickMimeType(candidates) {
  if (typeof MediaRecorder === 'undefined') return undefined;
  for (const t of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch { /* isTypeSupported can throw on odd strings */ }
  }
  return undefined;
}

function mediaErrorMessage(err) {
  const name = err?.name || '';
  if (name === 'NotAllowedError') return 'Permission denied — allow access in your browser and try again.';
  if (name === 'NotFoundError') return 'No capture device found.';
  if (name === 'NotReadableError') return 'Your camera or microphone is in use by another app.';
  return err?.message || 'Capture failed.';
}

const ACTIVITY_DATE = () => new Date().toISOString().split('T')[0];

// ============================================================================
// A-1 — VIDEO MESSAGES
// ============================================================================
export function VideoMessageRecorder({ user, clientId = null, dealId = null, showToast, onSaved }) {
  const [phase, setPhase] = useState('idle'); // idle | recording | preview | uploading
  const [blob, setBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  // Revoke the object URL when it changes or the component unmounts, otherwise
  // a long session leaks the whole recording into memory.
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => () => {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  async function start() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      showToast('Screen recording is not supported in this browser.', 'error');
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    } catch (err) {
      if (err?.name !== 'NotAllowedError') showToast(mediaErrorMessage(err), 'error');
      return;
    }
    streamRef.current = stream;
    const mimeType = pickMimeType(['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']);
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const b = new Blob(chunksRef.current, { type: 'video/webm' });
      setBlob(b);
      setPreviewUrl(URL.createObjectURL(b));
      setPhase('preview');
    };
    // The browser's own "Stop sharing" bar bypasses our Stop button entirely.
    stream.getVideoTracks()[0].onended = () => { if (recorder.state !== 'inactive') stop(); };
    recorder.start();
    recorderRef.current = recorder;
    setPhase('recording');
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  }

  function stop() {
    if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    clearInterval(timerRef.current);
  }

  function discard() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setBlob(null);
    setPhase('idle');
    setElapsed(0);
  }

  async function save() {
    if (!blob) return;
    setPhase('uploading');
    // First path segment must be the uid — the bucket policy matches on it.
    const path = `${user.id}/video-messages/${mediaToken('vid')}.webm`;
    const { error: upErr } = await supabase.storage.from('media').upload(path, blob, { contentType: 'video/webm' });
    if (upErr) { showToast(`Upload failed: ${upErr.message}`, 'error'); setPhase('preview'); return; }

    const token = mediaToken('share');
    const { data, error } = await supabase.from('video_messages').insert([{
      user_id: user.id,
      client_id: clientId ?? null,
      deal_id: dealId ?? null,
      storage_path: path,
      duration_seconds: elapsed,
      shared_token: token,
      view_count: 0,
    }]).select().single();
    if (error) { showToast(`Save failed: ${error.message}`, 'error'); setPhase('preview'); return; }

    // Ground truth: activity_date (not date), description NOT NULL, no outcome.
    if (clientId) {
      await supabase.from('activities').insert([{
        user_id: user.id, client_id: clientId, activity_type: 'Note',
        activity_date: ACTIVITY_DATE(),
        description: `Recorded a ${formatTime(elapsed)} video update.`,
      }]);
    }
    discard();
    onSaved?.(data);
    showToast('Video saved — link ready to share.', 'success');
  }

  return (
    <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-800">
      {phase === 'idle' && (
        <div className="flex items-center gap-3">
          <Button onClick={start}>Record a video update</Button>
          <span className="text-[12px] text-gray-400">Captures a screen or tab, with audio.</span>
        </div>
      )}
      {phase === 'recording' && (
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="font-mono text-[16px] text-gray-900 dark:text-gray-100">{formatTime(elapsed)}</span>
          <Button variant="danger" onClick={stop}>Stop</Button>
        </div>
      )}
      {phase === 'preview' && previewUrl && (
        <>
          <video src={previewUrl} controls className="w-full rounded-lg mb-3 max-h-64 bg-black" />
          <div className="flex gap-2">
            <Button variant="ghost" onClick={discard}>Discard</Button>
            <Button onClick={save}>Save &amp; Get Link</Button>
          </div>
        </>
      )}
      {phase === 'uploading' && <p className="text-[13px] text-gray-400">Uploading…</p>}
    </div>
  );
}

export function VideoMessageList({ user, videos, showToast, onDeleted }) {
  const [openId, setOpenId] = useState(null);
  const [signed, setSigned] = useState({});

  // The user owns these objects, so their own session can sign them. Public
  // viewers go through the edge function instead.
  async function toggle(v) {
    if (openId === v.id) { setOpenId(null); return; }
    setOpenId(v.id);
    if (!signed[v.id]) {
      const { data, error } = await supabase.storage.from('media').createSignedUrl(v.storage_path, 3600);
      if (error) { showToast(`Could not load video: ${error.message}`, 'error'); return; }
      setSigned((s) => ({ ...s, [v.id]: data.signedUrl }));
    }
  }

  function copyLink(v) {
    const url = `${window.location.origin}/v/${v.shared_token}`;
    navigator.clipboard?.writeText(url);
    showToast('Share link copied.', 'success');
  }

  async function remove(v) {
    await supabase.storage.from('media').remove([v.storage_path]);
    const { error } = await supabase.from('video_messages').delete().eq('id', v.id);
    if (error) { showToast(error.message, 'error'); return; }
    onDeleted?.(v.id);
    showToast('Video deleted.', 'success');
  }

  if (!videos.length) return <p className="text-[13px] text-gray-400">No video updates yet.</p>;

  return (
    <div className="space-y-2">
      {videos.map((v) => (
        <div key={v.id} className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">
                {formatTime(v.duration_seconds)} video
              </p>
              <p className="text-[11px] text-gray-400">
                {formatRelativeTime(v.created_at)} · {v.view_count || 0} view{(v.view_count || 0) === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button variant="ghost" onClick={() => toggle(v)}>{openId === v.id ? 'Hide' : 'Play'}</Button>
              <Button variant="ghost" onClick={() => copyLink(v)}>Copy link</Button>
              <Button variant="ghost" onClick={() => remove(v)}>Delete</Button>
            </div>
          </div>
          {openId === v.id && signed[v.id] && (
            <video src={signed[v.id]} controls autoPlay className="w-full rounded-lg mt-3 max-h-72 bg-black" />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// A-2 — WEBRTC CALLING
// Signaling rides Supabase Realtime broadcast on a per-room channel. STUN only.
// ============================================================================
export function VideoCallRoom({ roomToken, isInitiator, onEnd }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const channelRef = useRef(null);
  const localStreamRef = useRef(null);
  const endedRef = useRef(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  // Tear down exactly once — cleanup runs from the effect return, the hangup
  // button, and the peer's hangup broadcast.
  const teardown = useCallback((notifyParent) => {
    if (endedRef.current) return;
    endedRef.current = true;
    try { pcRef.current?.close(); } catch { /* already closed */ }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    try { channelRef.current?.unsubscribe(); } catch { /* already gone */ }
    if (notifyParent) onEnd?.();
  }, [onEnd]);

  useEffect(() => {
    endedRef.current = false;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcRef.current = pc;
    const channel = supabase.channel(`call:${roomToken}`);
    channelRef.current = channel;

    let cancelled = false;
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      })
      .catch((err) => setError(mediaErrorMessage(err)));

    pc.ontrack = (e) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
      setConnected(true);
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) channel.send({ type: 'broadcast', event: 'ice', payload: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) setConnected(false);
      if (pc.connectionState === 'failed') {
        setError('Connection failed — this network likely needs a TURN relay.');
      }
    };

    channel
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (isInitiator) return;
        await pc.setRemoteDescription(payload);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        channel.send({ type: 'broadcast', event: 'answer', payload: { type: answer.type, sdp: answer.sdp } });
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (isInitiator && !pc.currentRemoteDescription) await pc.setRemoteDescription(payload);
      })
      .on('broadcast', { event: 'ice' }, async ({ payload }) => {
        try { await pc.addIceCandidate(payload); } catch { /* candidates can arrive pre-description */ }
      })
      .on('broadcast', { event: 'hangup' }, () => teardown(true))
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && isInitiator) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          channel.send({ type: 'broadcast', event: 'offer', payload: { type: offer.type, sdp: offer.sdp } });
        }
      });

    return () => { cancelled = true; teardown(false); };
  }, [roomToken, isInitiator, teardown]);

  function hangup() {
    channelRef.current?.send({ type: 'broadcast', event: 'hangup', payload: {} });
    teardown(true);
  }

  function toggleMic() {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }
  function toggleCam() {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
      <video ref={localVideoRef} autoPlay muted playsInline
        className="absolute bottom-6 right-6 w-40 rounded-xl border-2 border-white shadow-xl object-cover" />
      {!connected && !error && (
        <p className="absolute top-6 text-white/70 text-[13px]">Waiting for the other person to join…</p>
      )}
      {error && (
        <p className="absolute top-6 max-w-md text-center text-red-300 text-[13px] px-4">{error}</p>
      )}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
        <button type="button" onClick={toggleMic}
          className="px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white rounded-full text-[13px] font-semibold backdrop-blur">
          {micOn ? 'Mute' : 'Unmute'}
        </button>
        <button type="button" onClick={toggleCam}
          className="px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white rounded-full text-[13px] font-semibold backdrop-blur">
          {camOn ? 'Camera off' : 'Camera on'}
        </button>
        <button type="button" onClick={hangup}
          className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-full text-[13px] font-semibold">
          End Call
        </button>
      </div>
    </div>
  );
}

// Creates the session row and hands back the room token + shareable join link.
export async function startCall({ user, clientId, showToast }) {
  const token = mediaToken('call');
  const { data, error } = await supabase.from('call_sessions').insert([{
    user_id: user.id, client_id: clientId ?? null, room_token: token,
    status: 'pending', started_at: new Date().toISOString(),
  }]).select().single();
  if (error) { showToast?.(`Could not start call: ${error.message}`, 'error'); return null; }
  const joinUrl = `${window.location.origin}/call/${token}`;
  try { await navigator.clipboard?.writeText(joinUrl); } catch { /* clipboard may be blocked */ }
  showToast?.('Call started — join link copied to your clipboard.', 'success');
  return { session: data, roomToken: token, joinUrl };
}

export async function endCall(roomToken) {
  await supabase.from('call_sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('room_token', roomToken);
}

// ============================================================================
// A-3 — AUDIO RECORDER WITH TIMESTAMPED NOTES
// ============================================================================
export function AudioRecorderWithNotes({ user, clientId, showToast, onSaved }) {
  const [phase, setPhase] = useState('idle'); // idle | recording | saving
  const [elapsed, setElapsed] = useState(0);
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    recorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
  }, []);

  async function start() {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) { showToast(mediaErrorMessage(err), 'error'); return; }
    const mimeType = pickMimeType(['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']);
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
    rec.start();
    recorderRef.current = rec;
    setPhase('recording');
    setElapsed(0);
    setNotes([]);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  }

  function addNote() {
    if (!noteText.trim()) return;
    setNotes((prev) => [...prev, { offset_seconds: elapsed, note: noteText.trim() }]);
    setNoteText('');
  }

  function cancel() {
    const rec = recorderRef.current;
    if (rec) {
      rec.onstop = null;
      if (rec.state !== 'inactive') rec.stop();
      rec.stream.getTracks().forEach((t) => t.stop());
    }
    clearInterval(timerRef.current);
    chunksRef.current = [];
    setPhase('idle');
    setNotes([]);
    setElapsed(0);
  }

  async function stopAndSave() {
    const rec = recorderRef.current;
    if (!rec) return;
    setPhase('saving');
    clearInterval(timerRef.current);
    // MediaRecorder flushes its last chunk asynchronously — wait for onstop
    // before building the Blob or the tail of the recording is lost.
    const finished = rec.state === 'inactive'
      ? Promise.resolve()
      : new Promise((resolve) => { rec.onstop = resolve; });
    if (rec.state !== 'inactive') rec.stop();
    await finished;
    rec.stream.getTracks().forEach((t) => t.stop());

    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    const path = `${user.id}/call-recordings/${mediaToken('rec')}.webm`;
    const { error: upErr } = await supabase.storage.from('media').upload(path, blob, { contentType: 'audio/webm' });
    if (upErr) { showToast(`Upload failed: ${upErr.message}`, 'error'); setPhase('recording'); return; }

    const { data: recRow, error } = await supabase.from('call_recordings').insert([{
      user_id: user.id, client_id: clientId ?? null, storage_path: path, duration_seconds: elapsed,
    }]).select().single();
    if (error) { showToast(`Save failed: ${error.message}`, 'error'); setPhase('recording'); return; }

    let savedNotes = [];
    if (notes.length) {
      const { data: noteRows, error: nErr } = await supabase.from('call_note_timestamps')
        .insert(notes.map((n) => ({ recording_id: recRow.id, offset_seconds: n.offset_seconds, note: n.note })))
        .select();
      if (nErr) showToast(`Recording saved, but notes failed: ${nErr.message}`, 'error');
      else savedNotes = noteRows || [];
    }

    if (clientId) {
      await supabase.from('activities').insert([{
        user_id: user.id, client_id: clientId, activity_type: 'Call',
        activity_date: ACTIVITY_DATE(),
        description: `Recorded a ${formatTime(elapsed)} call with ${notes.length} tagged moment${notes.length === 1 ? '' : 's'}.`,
      }]);
    }

    setPhase('idle');
    setNotes([]);
    setElapsed(0);
    onSaved?.(recRow, savedNotes);
    showToast(`Saved ${formatTime(elapsed)} recording with ${notes.length} note${notes.length === 1 ? '' : 's'}.`, 'success');
  }

  return (
    <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-800">
      {phase === 'idle' ? (
        <div className="flex items-center gap-3">
          <Button onClick={start}>Record a call</Button>
          <span className="text-[12px] text-gray-400">Tag moments as you go — they become clickable timestamps.</span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <p className="text-[20px] font-mono text-gray-900 dark:text-gray-100">{formatTime(elapsed)}</p>
          </div>
          <div className="flex gap-2 mb-3">
            <input value={noteText} onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNote(); } }}
              placeholder="Tag a moment while recording…" className={inputCls} disabled={phase === 'saving'} />
            <Button variant="ghost" onClick={addNote} disabled={phase === 'saving'}>Tag</Button>
          </div>
          <div className="space-y-1 mb-3 max-h-32 overflow-y-auto">
            {notes.map((n, i) => (
              <p key={i} className="text-[12px] text-gray-500 dark:text-gray-400">
                <span className="font-mono">{formatTime(n.offset_seconds)}</span> — {n.note}
              </p>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="danger" onClick={stopAndSave} disabled={phase === 'saving'}>
              {phase === 'saving' ? 'Saving…' : 'Stop & Save'}
            </Button>
            <Button variant="ghost" onClick={cancel} disabled={phase === 'saving'}>Discard</Button>
          </div>
        </>
      )}
    </div>
  );
}

export function RecordingPlayback({ recording, notes, showToast }) {
  const [signedUrl, setSignedUrl] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    let alive = true;
    if (!recording?.storage_path) return undefined;
    supabase.storage.from('media').createSignedUrl(recording.storage_path, 3600).then(({ data, error }) => {
      if (!alive) return;
      if (error) { showToast?.(`Could not load recording: ${error.message}`, 'error'); return; }
      setSignedUrl(data?.signedUrl || null);
    });
    return () => { alive = false; };
  }, [recording?.storage_path, showToast]);

  const sorted = useMemo(
    () => [...(notes || [])].sort((a, b) => a.offset_seconds - b.offset_seconds),
    [notes],
  );

  function seek(offset) {
    if (!audioRef.current) return;
    audioRef.current.currentTime = offset;
    audioRef.current.play();
  }

  return (
    <div>
      {signedUrl
        ? <audio ref={audioRef} src={signedUrl} controls className="w-full mb-3"
            onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)} />
        : <p className="text-[12px] text-gray-400 mb-3">Loading audio…</p>}
      {sorted.length === 0
        ? <p className="text-[12px] text-gray-400">No tagged moments.</p>
        : (
          <div className="space-y-1">
            {sorted.map((n) => {
              // Highlight the note the playhead is currently sitting inside.
              const idx = sorted.indexOf(n);
              const nextAt = sorted[idx + 1]?.offset_seconds ?? Infinity;
              const active = currentTime >= n.offset_seconds && currentTime < nextAt;
              return (
                <button key={n.id ?? `${n.offset_seconds}-${n.note}`} type="button"
                  onClick={() => seek(n.offset_seconds)}
                  className={`block text-left text-[12px] hover:underline ${active
                    ? 'font-bold text-indigo-700 dark:text-indigo-300'
                    : 'text-indigo-600 dark:text-indigo-400'}`}>
                  <span className="font-mono">{formatTime(n.offset_seconds)}</span> — {n.note}
                </button>
              );
            })}
          </div>
        )}
    </div>
  );
}

export function RecordingList({ recordings, noteTimestamps, showToast, onDeleted }) {
  const [openId, setOpenId] = useState(null);

  async function remove(r) {
    await supabase.storage.from('media').remove([r.storage_path]);
    const { error } = await supabase.from('call_recordings').delete().eq('id', r.id);
    if (error) { showToast(error.message, 'error'); return; }
    onDeleted?.(r.id);
    showToast('Recording deleted.', 'success');
  }

  if (!recordings.length) return <p className="text-[13px] text-gray-400">No call recordings yet.</p>;

  return (
    <div className="space-y-2">
      {recordings.map((r) => {
        const notes = (noteTimestamps || []).filter((n) => n.recording_id === r.id);
        return (
          <div key={r.id} className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">
                  {formatTime(r.duration_seconds)} recording
                </p>
                <p className="text-[11px] text-gray-400">
                  {formatRelativeTime(r.created_at)} · {notes.length} tagged moment{notes.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button variant="ghost" onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                  {openId === r.id ? 'Hide' : 'Open'}
                </Button>
                <Button variant="ghost" onClick={() => remove(r)}>Delete</Button>
              </div>
            </div>
            {openId === r.id && (
              <div className="mt-3">
                <RecordingPlayback recording={r} notes={notes} showToast={showToast} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// A-4 — VOICE MEMOS
// ============================================================================
export function VoiceMemoRecorder({ user, clientId = null, dealId = null, showToast, onSaved }) {
  const [phase, setPhase] = useState('idle'); // idle | recording | saving
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    recorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
  }, []);

  async function start() {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) { showToast(mediaErrorMessage(err), 'error'); return; }
    const mimeType = pickMimeType(['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']);
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
    rec.start();
    recorderRef.current = rec;
    setPhase('recording');
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  }

  function cancel() {
    const rec = recorderRef.current;
    if (rec) {
      rec.onstop = null;
      if (rec.state !== 'inactive') rec.stop();
      rec.stream.getTracks().forEach((t) => t.stop());
    }
    clearInterval(timerRef.current);
    chunksRef.current = [];
    setPhase('idle');
    setElapsed(0);
  }

  async function stopAndSave() {
    const rec = recorderRef.current;
    if (!rec) return;
    setPhase('saving');
    clearInterval(timerRef.current);
    const finished = rec.state === 'inactive'
      ? Promise.resolve()
      : new Promise((resolve) => { rec.onstop = resolve; });
    if (rec.state !== 'inactive') rec.stop();
    await finished;
    rec.stream.getTracks().forEach((t) => t.stop());

    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    const path = `${user.id}/voice-memos/${mediaToken('memo')}.webm`;
    const { error: upErr } = await supabase.storage.from('media').upload(path, blob, { contentType: 'audio/webm' });
    if (upErr) { showToast(`Upload failed: ${upErr.message}`, 'error'); setPhase('recording'); return; }

    const { data, error } = await supabase.from('voice_memos').insert([{
      user_id: user.id, client_id: clientId ?? null, deal_id: dealId ?? null,
      storage_path: path, duration_seconds: elapsed,
    }]).select().single();
    if (error) { showToast(`Save failed: ${error.message}`, 'error'); setPhase('recording'); return; }

    setPhase('idle');
    setElapsed(0);
    onSaved?.(data);
    showToast(`Voice memo saved (${formatTime(elapsed)}).`, 'success');
  }

  return (
    <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-800">
      {phase === 'idle' ? (
        <div className="flex items-center gap-3">
          <Button onClick={start}>Record a voice memo</Button>
          <span className="text-[12px] text-gray-400">A quick spoken note attached to this record.</span>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="font-mono text-[16px] text-gray-900 dark:text-gray-100">{formatTime(elapsed)}</span>
          <Button variant="danger" onClick={stopAndSave} disabled={phase === 'saving'}>
            {phase === 'saving' ? 'Saving…' : 'Stop & Save'}
          </Button>
          <Button variant="ghost" onClick={cancel} disabled={phase === 'saving'}>Discard</Button>
        </div>
      )}
    </div>
  );
}

export function VoiceMemoList({ memos, showToast, onDeleted }) {
  const [signed, setSigned] = useState({});

  // Sign every memo up front — the list is short and an <audio> element needs
  // a real src before the user presses play.
  useEffect(() => {
    let alive = true;
    (async () => {
      for (const m of memos) {
        if (signed[m.id]) continue;
        const { data } = await supabase.storage.from('media').createSignedUrl(m.storage_path, 3600);
        if (!alive) return;
        if (data?.signedUrl) setSigned((s) => ({ ...s, [m.id]: data.signedUrl }));
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memos.map((m) => m.id).join(',')]);

  async function remove(m) {
    await supabase.storage.from('media').remove([m.storage_path]);
    const { error } = await supabase.from('voice_memos').delete().eq('id', m.id);
    if (error) { showToast(error.message, 'error'); return; }
    onDeleted?.(m.id);
    showToast('Voice memo deleted.', 'success');
  }

  if (!memos.length) return <p className="text-[13px] text-gray-400">No voice memos yet.</p>;

  return (
    <div className="space-y-2">
      {memos.map((m) => (
        <div key={m.id} className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-[12px] text-gray-400">
              {formatTime(m.duration_seconds)} · {formatRelativeTime(m.created_at)}
            </p>
            <Button variant="ghost" onClick={() => remove(m)}>Delete</Button>
          </div>
          {signed[m.id]
            ? <audio src={signed[m.id]} controls className="w-full" />
            : <p className="text-[12px] text-gray-400">Loading…</p>}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// A-6 — BUSINESS CARD OCR
// Tesseract runs as WASM in the browser. The photo itself is never uploaded —
// only the parsed text fields the user confirms.
// ============================================================================

// Exported so the parsing rules can be reasoned about (and tested) separately
// from the camera/OCR plumbing.
export function parseCardText(text) {
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  const phoneMatch = text.match(/(\+?\d[\d\s().-]{7,}\d)/);
  const urlMatch = text.match(/(?:https?:\/\/)?(?:www\.)?([\w-]+\.[a-z]{2,})(?:\/\S*)?/i);
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Lines that are obviously contact details aren't the person's name.
  const isContactLine = (l) =>
    /@/.test(l) || /\d{3}/.test(l) || /^(www\.|https?:)/i.test(l);
  const nameLine = lines.find((l) => !isContactLine(l) && l.length >= 2 && l.length <= 40) || lines[0] || '';

  const companyLine =
    lines.find((l) => /\b(inc|llc|corp|co|ltd|gmbh|group|studio|labs|partners|holdings|ventures)\b\.?/i.test(l))
    || lines.find((l) => l !== nameLine && !isContactLine(l))
    || '';

  // A title usually sits directly under the name.
  const nameIdx = lines.indexOf(nameLine);
  const titleLine = lines
    .slice(nameIdx + 1)
    .find((l) => l !== companyLine && !isContactLine(l)
      && /\b(engineer|manager|director|founder|ceo|cto|coo|cfo|head|lead|designer|developer|analyst|consultant|president|partner|officer|specialist|architect)\b/i.test(l))
    || '';

  return {
    raw: text,
    name: nameLine,
    company: companyLine,
    title: titleLine,
    email: emailMatch?.[0] || '',
    phone: phoneMatch?.[0]?.trim() || '',
    website: emailMatch ? '' : (urlMatch?.[1] || ''),
  };
}

export function BusinessCardScanner({ user, showToast, onSaved }) {
  const [imagePreview, setImagePreview] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [parsed, setParsed] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview); }, [imagePreview]);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(URL.createObjectURL(file));
    setParsed(null);
    setScanning(true);
    setProgress(0);
    try {
      // Dynamic import keeps the ~2MB WASM worker out of the main bundle —
      // it only loads when someone actually scans a card.
      const Tesseract = (await import('tesseract.js')).default;
      const { data: { text } } = await Tesseract.recognize(file, 'eng', {
        logger: (m) => { if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100)); },
      });
      setParsed(parseCardText(text));
    } catch (err) {
      showToast(`Could not read the card: ${err.message}`, 'error');
    } finally {
      setScanning(false);
    }
  }

  async function handleSave() {
    if (!parsed?.name?.trim()) { showToast('A name is required to save a relationship.', 'error'); return; }
    setSaving(true);
    const { data: client, error } = await supabase.from('clients').insert([{
      user_id: user.id, name: parsed.name.trim(), email: parsed.email || null,
      phone_number: parsed.phone || null, company_name: parsed.company || null,
      source: 'Business Card', captured_via: 'business_card',
      status: 'Active', relationship: 'Medium',
    }]).select().single();
    if (error) { showToast(`Save failed: ${error.message}`, 'error'); setSaving(false); return; }

    const { error: scanErr } = await supabase.from('card_scans').insert([{
      user_id: user.id, raw_ocr_text: parsed.raw, parsed_name: parsed.name,
      parsed_email: parsed.email || null, parsed_phone: parsed.phone || null,
      parsed_company: parsed.company || null, parsed_title: parsed.title || null,
      client_id: client.id,
    }]);
    if (scanErr) showToast(`Relationship saved, but the scan record failed: ${scanErr.message}`, 'error');

    await supabase.from('activities').insert([{
      user_id: user.id, client_id: client.id, activity_type: 'Note',
      activity_date: ACTIVITY_DATE(),
      description: `Added from a scanned business card${parsed.title ? ` — ${parsed.title}` : ''}.`,
    }]);

    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setParsed(null);
    setSaving(false);
    onSaved?.(client);
    showToast('Contact added from card scan.', 'success');
  }

  const set = (k) => (e) => setParsed((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-800">
      <p className="text-[12px] text-gray-400 mb-2">
        The photo is read on your device and never uploaded — only the fields you confirm are saved.
      </p>
      <input type="file" accept="image/*" capture="environment" onChange={handleFile}
        className="block w-full text-[13px] mb-3 text-gray-600 dark:text-gray-300" />
      {imagePreview && <img src={imagePreview} className="max-w-xs rounded-xl mb-3" alt="Scanned business card" />}
      {scanning && <p className="text-[13px] text-gray-400">Reading card… {progress}%</p>}
      {parsed && !scanning && (
        <div className="space-y-2 max-w-sm">
          <Field label="Name"><input value={parsed.name} onChange={set('name')} className={inputCls} /></Field>
          <Field label="Email"><input value={parsed.email} onChange={set('email')} className={inputCls} /></Field>
          <Field label="Phone"><input value={parsed.phone} onChange={set('phone')} className={inputCls} /></Field>
          <Field label="Company"><input value={parsed.company} onChange={set('company')} className={inputCls} /></Field>
          <Field label="Title"><input value={parsed.title} onChange={set('title')} className={inputCls} /></Field>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save as Relationship'}</Button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// A-5 — CHROME EXTENSION TOKEN MANAGEMENT (Settings surface)
// ============================================================================
export function CaptureTokenSettings({ user, showToast }) {
  const [tokenRow, setTokenRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);

  // Same-origin Next.js route (service-role backed). A functionally identical
  // Supabase edge function is also deployed at
  // `${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/capture-extension` for
  // deployments where SUPABASE_SERVICE_ROLE_KEY isn't in the Next runtime.
  const [endpoint, setEndpoint] = useState('');
  useEffect(() => { setEndpoint(`${window.location.origin}/api/v1/capture-extension`); }, []);

  useEffect(() => {
    let alive = true;
    supabase.from('capture_extension_tokens').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { if (alive) { setTokenRow(data || null); setLoading(false); } });
    return () => { alive = false; };
  }, [user.id]);

  // Regenerating deletes every prior row, so an old token stops working the
  // moment a new one is issued.
  async function generate() {
    const token = mediaToken('');
    await supabase.from('capture_extension_tokens').delete().eq('user_id', user.id);
    const { data, error } = await supabase.from('capture_extension_tokens')
      .insert([{ user_id: user.id, token }]).select().single();
    if (error) { showToast(error.message, 'error'); return; }
    setTokenRow(data);
    setRevealed(true);
    showToast('New capture token generated — the previous one no longer works.', 'success');
  }

  function copy(value, label) {
    navigator.clipboard?.writeText(value);
    showToast(`${label} copied.`, 'success');
  }

  if (loading) return <p className="text-[13px] text-gray-400">Loading…</p>;

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-gray-600 dark:text-gray-300">
        The browser extension adds a “+ Add to CRM” button to LinkedIn profiles. Generate a token
        below, then paste it — along with the endpoint — into the extension’s options page.
      </p>
      {tokenRow ? (
        <>
          <div className="flex items-center gap-2">
            <input readOnly value={revealed ? tokenRow.token : '•'.repeat(32)} className={`${inputCls} font-mono`} />
            <Button variant="ghost" onClick={() => setRevealed((r) => !r)}>{revealed ? 'Hide' : 'Show'}</Button>
            <Button variant="ghost" onClick={() => copy(tokenRow.token, 'Token')}>Copy token</Button>
          </div>
          <div className="flex items-center gap-2">
            <input readOnly value={endpoint} className={`${inputCls} font-mono`} />
            <Button variant="ghost" onClick={() => copy(endpoint, 'Endpoint')}>Copy endpoint</Button>
          </div>
          <p className="text-[11px] text-gray-400">
            {tokenRow.last_used_at
              ? `Last used ${formatRelativeTime(tokenRow.last_used_at)}.`
              : 'Never used yet.'}
          </p>
          <Button variant="ghost" onClick={generate}>Regenerate (invalidates the old token)</Button>
        </>
      ) : (
        <Button onClick={generate}>Generate capture token</Button>
      )}
      <div className="text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed pt-2 border-t border-gray-100 dark:border-gray-800">
        <p className="font-semibold mb-1">Installing the extension</p>
        <ol className="list-decimal ml-4 space-y-0.5">
          <li>Open <span className="font-mono">chrome://extensions</span> and turn on Developer mode.</li>
          <li>Click “Load unpacked” and pick the <span className="font-mono">chrome-extension/</span> folder from this repo.</li>
          <li>Open the extension’s Options and paste the token and endpoint above.</li>
          <li>Visit any <span className="font-mono">linkedin.com/in/…</span> profile and click “+ Add to CRM”.</li>
        </ol>
      </div>
    </div>
  );
}
