'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Video, Square, CheckCircle2,
  Loader2, AlertCircle, Mic, MicOff, ShieldAlert
} from 'lucide-react';

interface VideoRecorderUploadProps {
  label: string;
  onVideoSubmit: (videoUrl: string) => void;
  defaultVideoUrl?: string;
  prepSeconds?: number;
  maxRecordSeconds?: number;
}

export default function VideoRecorderUpload({
  label,
  onVideoSubmit,
  defaultVideoUrl,
  prepSeconds = 60,
  maxRecordSeconds = 300
}: VideoRecorderUploadProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [prepLeft, setPrepLeft] = useState(prepSeconds);
  const [phase, setPhase] = useState<'prep' | 'record' | 'done'>(defaultVideoUrl ? 'done' : 'prep');
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(defaultVideoUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewStreamActive, setPreviewStreamActive] = useState(false);
  const [hasRetryableRecording, setHasRetryableRecording] = useState(false);

  // Audio Telemetry State
  const [hasAudioTrack, setHasAudioTrack] = useState<boolean>(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [micWarning, setMicWarning] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const lastRecordingRef = useRef<{ blob: Blob; filename: string } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioAnimFrameRef = useRef<number | null>(null);

  // Clean up streams & audio context on unmount
  useEffect(() => {
    return () => {
      stopAllMediaTracks();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (audioAnimFrameRef.current) cancelAnimationFrame(audioAnimFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const stopAllMediaTracks = () => {
    if (audioAnimFrameRef.current) {
      cancelAnimationFrame(audioAnimFrameRef.current);
      audioAnimFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
      streamRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
      audioStreamRef.current = null;
    }
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
      videoStreamRef.current = null;
    }
  };

  // Setup Web Audio API Level Meter for live mic verification
  const setupAudioMeter = (audioStream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      const source = audioCtx.createMediaStreamSource(audioStream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateMeter = () => {
        if (!analyser || !audioContextRef.current) return;
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        // Normalized 0 to 100
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setAudioLevel(normalized);

        audioAnimFrameRef.current = requestAnimationFrame(updateMeter);
      };

      updateMeter();
    } catch (err) {
      console.warn('Web Audio API meter setup notice:', err);
    }
  };

  const getMediaStream = async (): Promise<MediaStream | null> => {
    setMicWarning(null);
    let aStream: MediaStream | null = null;
    let vStream: MediaStream | null = null;

    // 1. Explicitly acquire Microphone Audio with echoCancellation
    try {
      aStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    } catch (aErr1) {
      console.warn('Advanced audio constraints failed, trying basic audio:', aErr1);
      try {
        aStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (aErr2) {
        console.error('Microphone acquisition error:', aErr2);
      }
    }

    // 2. Explicitly acquire Webcam Video
    try {
      vStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
      });
    } catch (vErr1) {
      try {
        vStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' }
        });
      } catch (vErr2) {
        try {
          vStream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (vErr3) {
          console.error('Webcam acquisition error:', vErr3);
        }
      }
    }

    if (!vStream && !aStream) {
      setErrorMessage('Could not access camera or microphone. Please check browser permissions.');
      return null;
    }

    audioStreamRef.current = aStream;
    videoStreamRef.current = vStream;

    const tracks: MediaStreamTrack[] = [];
    if (vStream) tracks.push(...vStream.getVideoTracks());
    if (aStream) {
      const aTracks = aStream.getAudioTracks();
      if (aTracks.length > 0) {
        aTracks.forEach(t => { t.enabled = true; });
        tracks.push(...aTracks);
        setHasAudioTrack(true);
        setupAudioMeter(aStream);
      } else {
        setHasAudioTrack(false);
        setMicWarning('No audio track detected in microphone stream.');
      }
    } else {
      setHasAudioTrack(false);
      setMicWarning('Microphone access was denied or not detected! Please allow microphone permissions so your voice is recorded.');
    }

    const combined = new MediaStream(tracks);
    streamRef.current = combined;
    return combined;
  };

  const uploadFileToServer = async (fileOrBlob: Blob, filename = 'recording.webm') => {
    setIsUploading(true);
    setErrorMessage(null);
    lastRecordingRef.current = { blob: fileOrBlob, filename };
    setHasRetryableRecording(true);
    try {
      const formData = new FormData();
      formData.append('file', fileOrBlob, filename);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Upload failed');
      }

      setRecordedVideoUrl(data.url);
      onVideoSubmit(data.url);
    } catch (err: any) {
      // Used to fall back to a local blob: URL here so the candidate was
      // "never blocked" — but that URL only exists inside this one browser
      // tab. It played back fine locally (false confidence that the
      // submission worked), then went on to get saved as the permanent
      // media_url: unplayable in any later report, and unfetchable by the
      // server-side AI scorer, which needs a real network-reachable URL.
      // A real upload failure needs to be visible and retryable, not
      // quietly swapped for data that looks right and isn't.
      console.error('Video upload error:', err);
      setErrorMessage(`Could not save your recording: ${err?.message || 'upload failed'}. Your recording is still here — try saving it again.`);
    } finally {
      setIsUploading(false);
    }
  };

  const retryUpload = () => {
    if (lastRecordingRef.current) {
      uploadFileToServer(lastRecordingRef.current.blob, lastRecordingRef.current.filename);
    }
  };

  const startRecording = async () => {
    setErrorMessage(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage('Camera or microphone is not available in this browser.');
      return;
    }

    try {
      const stream = await getMediaStream();
      if (!stream) return;

      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        try {
          await liveVideoRef.current.play();
        } catch (playErr) {
          console.warn('Live video play warning:', playErr);
        }
      }

      chunksRef.current = [];

      // Determine best audio/video mimeType with Opus audio codec
      let options: MediaRecorderOptions = {};
      const preferredMimeTypes = [
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=h264,opus',
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/webm',
        'video/mp4'
      ];

      if (typeof MediaRecorder !== 'undefined') {
        for (const mime of preferredMimeTypes) {
          if (MediaRecorder.isTypeSupported(mime)) {
            options = {
              mimeType: mime,
              audioBitsPerSecond: 128000,
              videoBitsPerSecond: 1500000
            };
            break;
          }
        }
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const mimeType = options.mimeType || 'video/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        stopAllMediaTracks();
        await uploadFileToServer(blob, `video_${Date.now()}.webm`);
      };

      mediaRecorder.start(1000); // chunk every second
      setIsRecording(true);
      setPhase('record');
      setRecordingSeconds(0);
      setPreviewStreamActive(true);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.error('Start recording error:', err);
      setErrorMessage(`Camera/Mic error: ${err.message || 'Permission denied. Allow camera and microphone to continue.'}`);
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }

    setIsRecording(false);
    setPreviewStreamActive(false);
    setPhase('done');
  };

  useEffect(() => {
    if (recordedVideoUrl || phase !== 'prep') return;
    let cancelled = false;
    (async () => {
      const stream = await getMediaStream();
      if (cancelled || !stream || !liveVideoRef.current) return;
      liveVideoRef.current.srcObject = stream;
      liveVideoRef.current.play().catch(() => {});
      setPreviewStreamActive(true);
    })();
    const timer = window.setInterval(() => {
      setPrepLeft((s) => {
        if (s <= 1) {
          window.clearInterval(timer);
          startRecording();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // start once when this question screen mounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isRecording && recordingSeconds >= maxRecordSeconds) {
      stopRecording();
    }
  }, [isRecording, recordingSeconds, maxRecordSeconds]);

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 text-xs shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <label className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <Video className="w-4 h-4 text-indigo-600" /> {label}
        </label>
        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Live camera only</span>
      </div>

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2.5 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="font-semibold">{errorMessage}</span>
        </div>
      )}

      {micWarning && isRecording && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 flex items-center gap-2 text-xs">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{micWarning}</span>
        </div>
      )}

      <div className="space-y-3">
        {!recordedVideoUrl && !isUploading && errorMessage && hasRetryableRecording ? (
          <div className="aspect-video rounded-xl bg-slate-900 flex flex-col items-center justify-center space-y-3 p-6 text-center">
            <AlertCircle className="w-8 h-8 text-rose-400" />
            <div className="text-sm font-bold text-white">Your recording could not be saved</div>
            <button
              type="button"
              onClick={retryUpload}
              className="px-5 py-2.5 bg-white text-slate-900 font-bold rounded-xl text-xs cursor-pointer hover:bg-slate-100"
            >
              Try saving it again
            </button>
          </div>
        ) : !recordedVideoUrl && !isUploading ? (
          <div className="relative aspect-video rounded-xl bg-slate-900 overflow-hidden border border-slate-200">
            <video
              ref={liveVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {phase === 'prep' && !isRecording && (
              <div className="absolute inset-0 bg-slate-950/70 flex flex-col items-center justify-center text-center p-6">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-300">Preparation time</p>
                <p className="text-4xl font-black text-white font-mono mt-2">{prepLeft}s</p>
                <p className="text-xs text-slate-300 mt-2 max-w-sm">Read the question. Face the camera. Recording starts on its own when this timer ends. You do not need to press record.</p>
              </div>
            )}
            {isRecording && (
              <>
                <div className="absolute top-3 left-3 bg-rose-600 text-white px-3.5 py-1.5 rounded-full font-mono font-bold text-xs flex items-center gap-2 shadow-lg z-20">
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                  <span>REC {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}</span>
                </div>
                <div className="absolute top-3 right-3 bg-slate-900/90 px-3 py-1.5 rounded-full font-mono text-xs flex items-center gap-2 z-20">
                  {hasAudioTrack ? <Mic className="w-3.5 h-3.5 text-indigo-300" /> : <MicOff className="w-3.5 h-3.5 text-rose-400" />}
                  <span className="text-white text-[10px] font-bold">{audioLevel > 5 ? 'Mic on' : 'Speak up'}</span>
                </div>
              </>
            )}
          </div>
        ) : isUploading ? (
          <div className="aspect-video rounded-xl bg-slate-900 flex flex-col items-center justify-center space-y-3 p-6">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <div className="text-sm font-bold text-white">Saving your live recording…</div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="aspect-video rounded-xl bg-slate-900 overflow-hidden">
              <video src={recordedVideoUrl || ''} controls playsInline className="w-full h-full object-cover" />
            </div>
            <div className="flex items-center justify-between gap-2 p-2.5 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-800 text-xs">
              <span className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Recording saved
              </span>
            </div>
          </div>
        )}

        {isRecording && (
          <p className="text-[11px] text-slate-500 text-center">Recording stops automatically after {Math.round(maxRecordSeconds / 60)} minutes, or you can finish early.</p>
        )}
        {isRecording && (
          <button type="button" onClick={stopRecording} className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer">
            <Square className="w-4 h-4 fill-white" /> Finish recording
          </button>
        )}
      </div>
    </div>
  );
}
