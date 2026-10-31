'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, Eye, Sparkles, RefreshCw, Volume2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';

interface LiveProctoringWebcamProps {
  stageKey: string;
  candidateId: string;
  schoolId: string;
  onViolation?: (type: string, details: string) => void;
}

/** A reason the candidate can act on, instead of one message for every failure. */
function describeCameraError(err: any): string {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'The camera is blocked. Click the camera icon in the address bar, choose Allow, then press Enable Camera.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera was found. Plug in or turn on your webcam, then press Enable Camera.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Your camera is being used by another app or tab (Zoom, Meet, Teams or another browser window). Close it, then press Enable Camera.';
    case 'OverconstrainedError':
      return 'Your camera could not start at the requested quality. Press Enable Camera to try again.';
    case 'SecurityError':
      return 'The browser will not open the camera on this page. Make sure the address starts with https://.';
    default:
      return 'The camera could not start. Press Enable Camera to try again. If it keeps failing, restart your browser.';
  }
}

export default function LiveProctoringWebcam({ stageKey, candidateId, schoolId, onViolation }: LiveProctoringWebcamProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const cocoModelRef = useRef<cocoSsd.ObjectDetection | null>(null);

  // Baseline Calibration
  const isCalibratedRef = useRef<boolean>(false);
  const calibrationSamplesRef = useRef<{ v: number; h: number; pitch: number }[]>([]);
  const baselineRef = useRef<{ v: number; h: number; pitch: number }>({ v: 0.0, h: 0.5, pitch: 0.58 });

  // Temporal Filter Refs (Low-pass box filters to eliminate webcam sensor noise)
  const emaHorizontalRef = useRef<number>(0.5);
  const emaVerticalOffsetRef = useRef<number>(0.0);
  const emaPitchRef = useRef<number>(0.58);
  
  // Rolling smoothed gaze buffer for reading line-return saccades
  const smoothedGazeHistoryRef = useRef<{ x: number; y: number; px: number; py: number; t: number }[]>([]);
  const detectedObjectsRef = useRef<{ bbox: [number, number, number, number]; class: string; score: number }[]>([]);

  // Violation Persistence Frame Counters
  const downViolationCounter = useRef<number>(0);
  const upViolationCounter = useRef<number>(0);
  const gazeViolationCounter = useRef<number>(0);
  const readingViolationCounter = useRef<number>(0);
  const missingFaceCounter = useRef<number>(0);
  const lastVoiceAlertTimeRef = useRef<number>(0);

  // UI States
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [modelLoaded, setModelLoaded] = useState<boolean>(false);
  const [isCalibrating, setIsCalibrating] = useState<boolean>(true);
  const [calibrationProgress, setCalibrationProgress] = useState<number>(0);
  
  const [gazeDirection, setGazeDirection] = useState<
    'Center' | 'Looking Left' | 'Looking Right' | 'Looking Up' | 'Looking Down (Phone Alert)' | 'Reading Script' | 'Off-Screen'
  >('Center');
  const [faceDetected, setFaceDetected] = useState<boolean>(false);
  const [phoneDetected, setPhoneDetected] = useState<boolean>(false);
  const [detectedObjectName, setDetectedObjectName] = useState<string>('Clear');
  const [voiceAlertCount, setVoiceAlertCount] = useState<number>(0);
  const [activeVoiceToast, setActiveVoiceToast] = useState<{ message: string; visible: boolean; type: 'warning' | 'alert' }>({
    message: '',
    visible: false,
    type: 'warning'
  });
  
  const [, setLiveDeltaV] = useState<number>(0);
  const [liveDeltaH, setLiveDeltaH] = useState<number>(0);
  const [readingScore, setReadingScore] = useState<number>(0);
  const [headTiltStatus, setHeadTiltStatus] = useState<'Level' | 'Tilted Down' | 'Tilted Away'>('Level');
  const [modelWarning, setModelWarning] = useState<string | null>(null);
  // The spoken warnings and the script check are part of the test; the candidate cannot switch them off.
  const voiceMuted = false;
  const readingGuardEnabled = true;

  // Manual Trigger to Recalibrate Neutral Center
  const startCalibration = useCallback(() => {
    setIsCalibrating(true);
    setCalibrationProgress(0);
    calibrationSamplesRef.current = [];
    isCalibratedRef.current = false;
  }, []);

  // Audio Speech Warning Dispatcher with cooldown & immediate counter reset
  const triggerVoiceWarning = useCallback((spokenMessage: string, violationType: string, logDetails: string) => {
    const now = Date.now();
    // Minimum 8 seconds between voice interventions
    if (now - lastVoiceAlertTimeRef.current > 8000) {
      lastVoiceAlertTimeRef.current = now;
      setVoiceAlertCount(prev => prev + 1);
      setActiveVoiceToast({ message: spokenMessage, visible: true, type: 'alert' });

      // Reset all counters immediately to prevent looping
      downViolationCounter.current = 0;
      upViolationCounter.current = 0;
      gazeViolationCounter.current = 0;
      readingViolationCounter.current = 0;

      if (!voiceMuted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(spokenMessage);
          utterance.rate = 1.0;
          utterance.pitch = 1.0;
          utterance.lang = 'en-US';
          window.speechSynthesis.speak(utterance);
        } catch (e) {
          console.warn('[AI Proctor Voice Notice]:', e);
        }
      }

      onViolation?.(violationType, logDetails);

      setTimeout(() => {
        setActiveVoiceToast(prev => ({ ...prev, visible: false }));
      }, 5000);
    }
  }, [onViolation, voiceMuted]);

  // Filter MediaPipe & TensorFlow WASM diagnostic noise
  useEffect(() => {
    const originalError = console.error;
    const originalWarn = console.warn;

    console.error = (...args: any[]) => {
      const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
      if (msg.includes('TensorFlow') || msg.includes('XNNPACK') || msg.includes('Created TensorFlow Lite') || msg.includes('WebGL')) {
        return;
      }
      originalError.apply(console, args);
    };

    console.warn = (...args: any[]) => {
      const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
      if (msg.includes('TensorFlow') || msg.includes('XNNPACK') || msg.includes('Created TensorFlow Lite') || msg.includes('WebGL')) {
        return;
      }
      originalWarn.apply(console, args);
    };

    return () => {
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  // Initialize MediaPipe FaceLandmarker (local WASM) + COCO-SSD phone detect
  useEffect(() => {
    let isSubscribed = true;

    async function initModels() {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const wasmCandidates = [
        `${origin}/mediapipe/wasm`,
        '/mediapipe/wasm',
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm',
      ];
      const modelCandidates = [
        `${origin}/mediapipe/models/face_landmarker.task`,
        '/mediapipe/models/face_landmarker.task',
        'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      ];

      let landmarkerReady = false;
      for (const wasmPath of wasmCandidates) {
        if (landmarkerReady) break;
        for (const modelAssetPath of modelCandidates) {
          if (landmarkerReady) break;
          for (const delegate of ['GPU', 'CPU'] as const) {
            try {
              const filesetResolver = await FilesetResolver.forVisionTasks(wasmPath);
              const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
                baseOptions: {
                  modelAssetPath,
                  delegate,
                },
                runningMode: 'VIDEO',
                numFaces: 2,
                minFaceDetectionConfidence: 0.5,
                minFacePresenceConfidence: 0.5,
                minTrackingConfidence: 0.5,
              });
              if (isSubscribed) {
                faceLandmarkerRef.current = landmarker;
                setModelLoaded(true);
                setModelWarning(null);
                landmarkerReady = true;
              }
              break;
            } catch (err) {
              console.warn(`MediaPipe init failed (${wasmPath}, ${delegate}):`, err);
            }
          }
        }
      }

      if (!landmarkerReady && isSubscribed) {
        setModelWarning('Gaze AI offline — tab switch, fullscreen, and camera still proctor this session.');
      }

      try {
        const coco = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
        if (isSubscribed) {
          cocoModelRef.current = coco;
        }
      } catch (cocoErr) {
        console.warn('COCO-SSD model notice:', cocoErr);
      }
    }

    initModels();

    return () => {
      isSubscribed = false;
      if (faceLandmarkerRef.current) {
        try {
          faceLandmarkerRef.current.close();
        } catch {
          /* ignore */
        }
        faceLandmarkerRef.current = null;
      }
    };
  }, []);

  // Periodic COCO-SSD Object Scanning (every 600ms)
  useEffect(() => {
    let objectInterval: NodeJS.Timeout;

    const scanObjects = async () => {
      if (cocoModelRef.current && videoRef.current && videoRef.current.readyState >= 2) {
        try {
          const predictions = await cocoModelRef.current.detect(videoRef.current);
          const suspicious = predictions.filter(p => 
            ['cell phone', 'remote', 'laptop', 'tablet'].includes(p.class.toLowerCase()) && p.score > 0.55
          );

          detectedObjectsRef.current = suspicious;

          if (suspicious.length > 0) {
            const item = suspicious[0];
            setPhoneDetected(true);
            setDetectedObjectName(item.class);

            triggerVoiceWarning(
              'Secondary device detected. Please put away your phone.',
              'PHONE_DETECTED',
              `Prohibited object in frame: ${item.class} (${Math.round(item.score * 100)}% confidence).`
            );
          } else {
            setPhoneDetected(false);
            setDetectedObjectName('Clear');
          }
        } catch {
          // Frame skip
        }
      }
    };

    objectInterval = setInterval(scanObjects, 600);
    return () => clearInterval(objectInterval);
  }, [triggerVoiceWarning]);

  // Security Event Listeners (Copy, Paste, Shortcuts)
  useEffect(() => {
    const handleCopyPaste = (e: Event) => {
      e.preventDefault();
      triggerVoiceWarning('Copy and paste is prohibited.', 'COPY_PASTE_ATTEMPT', `Unauthorized ${e.type} blocked.`);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a', 'p'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        triggerVoiceWarning('Keyboard shortcut blocked.', 'COPY_PASTE_ATTEMPT', `Shortcut Ctrl/Cmd+${e.key.toUpperCase()} blocked.`);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      onViolation?.('COPY_PASTE_ATTEMPT', 'Right-click menu blocked.');
    };

    window.addEventListener('copy', handleCopyPaste);
    window.addEventListener('paste', handleCopyPaste);
    window.addEventListener('cut', handleCopyPaste);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('copy', handleCopyPaste);
      window.removeEventListener('paste', handleCopyPaste);
      window.removeEventListener('cut', handleCopyPaste);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [onViolation, triggerVoiceWarning]);

  const retriesRef = useRef(0);

  // Camera Initialization
  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('This browser cannot open the camera on this page. Use the latest Chrome or Edge, and make sure the address starts with https://.');
      setCameraActive(false);
      return;
    }
    try {
      setCameraError(null);
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false
        });
      }

      if (videoRef.current) {
        const video = videoRef.current;
        // Stop prior tracks before attaching a new stream
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = stream;
        video.srcObject = stream;
        setCameraActive(true);
        retriesRef.current = 0;
        // If the camera is unplugged or taken by another app, say so and try to
        // get it back rather than showing a frozen picture.
        stream.getVideoTracks().forEach((track) => {
          track.onended = () => {
            setCameraActive(false);
            setCameraError('The camera stopped. Close any other app using it. Reconnecting…');
            setTimeout(() => { startCamera(); }, 1500);
          };
        });

        const playWhenReady = () => {
          video.play().catch((err) => {
            if (err?.name !== 'AbortError') {
              console.warn('Live video play warning:', err);
            }
          });
        };

        if (video.readyState >= 2) {
          playWhenReady();
        } else {
          video.onloadedmetadata = () => playWhenReady();
        }
        startCalibration();
      }
    } catch (err: any) {
      setCameraError(describeCameraError(err));
      setCameraActive(false);
      // Another app or tab may be holding the camera for a moment (a video
      // call that is still closing, the recorder handing over). Try again by
      // itself a couple of times before leaving the candidate on an error.
      if ((err?.name === 'NotReadableError' || err?.name === 'AbortError') && retriesRef.current < 3) {
        retriesRef.current += 1;
        setTimeout(() => { startCamera(); }, 2000);
      }
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  // Main High-Frequency Frame Processing Loop
  useEffect(() => {
    let animationFrameId: number;
    let lastVideoTime = -1;

    const processFrame = () => {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video.readyState >= 2 && video.videoWidth > 0) {
          if (!cameraActive) setCameraActive(true);

          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }

          const ctx = canvas.getContext('2d');
          if (ctx) {
            const w = canvas.width;
            const h = canvas.height;
            ctx.clearRect(0, 0, w, h);

            let currentGaze: 'Center' | 'Looking Left' | 'Looking Right' | 'Looking Up' | 'Looking Down (Phone Alert)' | 'Reading Script' | 'Off-Screen' = 'Center';

            if (faceLandmarkerRef.current && video.currentTime !== lastVideoTime) {
              lastVideoTime = video.currentTime;
              try {
                const results = faceLandmarkerRef.current.detectForVideo(video, Math.round(performance.now()));
                const faces = results ? results.faceLandmarks : [];

                if (faces && faces.length > 0) {
                  missingFaceCounter.current = 0;
                  setFaceDetected(true);

                  if (faces.length > 1) {
                    triggerVoiceWarning(
                      'Multiple people detected. Only the candidate may be present.',
                      'MULTI_FACE_DETECTED',
                      `${faces.length} faces detected in stream.`
                    );
                  }

                  const lm = faces[0];

                  // 1. Landmarks for Orbital Frame
                  const leftIris = lm[468] || lm[33];
                  const leftOuter = lm[33];
                  const leftInner = lm[133];
                  
                  const rightIris = lm[473] || lm[263];
                  const rightInner = lm[362];
                  const rightOuter = lm[263];

                  const forehead = lm[10];
                  const noseTip = lm[1];
                  const chin = lm[152];

                  const lx = leftIris.x * w;
                  const ly = leftIris.y * h;
                  const rx = rightIris.x * w;
                  const ry = rightIris.y * h;

                  // 2. Horizontal Gaze Ratio (Normalized by eye width)
                  const leftEyeWidth = Math.max(0.01, Math.abs(leftInner.x - leftOuter.x));
                  const leftIrisRel = (leftIris.x - leftOuter.x) / leftEyeWidth;

                  const rightEyeWidth = Math.max(0.01, Math.abs(rightOuter.x - rightInner.x));
                  const rightIrisRel = (rightIris.x - rightInner.x) / rightEyeWidth;

                  const rawH = (leftIrisRel + rightIrisRel) / 2;
                  emaHorizontalRef.current = 0.20 * rawH + 0.80 * emaHorizontalRef.current;
                  const avgH = emaHorizontalRef.current;

                  // 3. Orbital Plane Vertical Gaze (Relative to Skull Orbit Line)
                  const leftCornerMidY = (leftOuter.y + leftInner.y) / 2;
                  const rightCornerMidY = (rightInner.y + rightOuter.y) / 2;

                  const leftVOffset = (leftIris.y - leftCornerMidY) / leftEyeWidth;
                  const rightVOffset = (rightIris.y - rightCornerMidY) / rightEyeWidth;

                  const rawVOffset = (leftVOffset + rightVOffset) / 2;
                  emaVerticalOffsetRef.current = 0.20 * rawVOffset + 0.80 * emaVerticalOffsetRef.current;
                  const avgVOffset = emaVerticalOffsetRef.current;

                  // 4. Head 3D Pitch
                  const headSpanY = Math.max(0.01, Math.abs(chin.y - forehead.y));
                  const rawPitch = (noseTip.y - forehead.y) / headSpanY;
                  emaPitchRef.current = 0.2 * rawPitch + 0.8 * emaPitchRef.current;
                  const avgPitch = emaPitchRef.current;

                  // AUTO-CALIBRATION SAMPLER (Gathers 45 frames of resting eye position)
                  if (!isCalibratedRef.current) {
                    calibrationSamplesRef.current.push({ v: avgVOffset, h: avgH, pitch: avgPitch });
                    const progress = Math.min(100, Math.round((calibrationSamplesRef.current.length / 45) * 100));
                    setCalibrationProgress(progress);

                    if (calibrationSamplesRef.current.length >= 45) {
                      const sumV = calibrationSamplesRef.current.reduce((acc, cur) => acc + cur.v, 0);
                      const sumH = calibrationSamplesRef.current.reduce((acc, cur) => acc + cur.h, 0);
                      const sumP = calibrationSamplesRef.current.reduce((acc, cur) => acc + cur.pitch, 0);
                      const n = calibrationSamplesRef.current.length;

                      baselineRef.current = {
                        v: sumV / n,
                        h: sumH / n,
                        pitch: sumP / n
                      };

                      isCalibratedRef.current = true;
                      setIsCalibrating(false);
                    }
                  }

                  // 5. RELATIVE DEVIATION FROM CANDIDATE'S NEUTRAL BASELINE
                  const deltaV = avgVOffset - baselineRef.current.v;
                  const deltaH = avgH - baselineRef.current.h;
                  const deltaPitch = avgPitch - baselineRef.current.pitch;

                  setLiveDeltaV(deltaV);
                  setLiveDeltaH(deltaH);

                  if (deltaPitch > 0.10) {
                    setHeadTiltStatus('Tilted Down');
                  } else if (deltaPitch < -0.10) {
                    setHeadTiltStatus('Tilted Away');
                  } else {
                    setHeadTiltStatus('Level');
                  }

                  // 6. NOISE-IMMUNE SCRIPT READING DETECTOR (Line Return Saccades)
                  // Use low-pass filtered smoothed samples (avgH) to completely ignore sensor noise
                  const nowTs = performance.now();
                  smoothedGazeHistoryRef.current.push({ x: avgH, y: deltaV, px: lx, py: ly, t: nowTs });
                  if (smoothedGazeHistoryRef.current.length > 60) {
                    smoothedGazeHistoryRef.current.shift();
                  }

                  const sBuf = smoothedGazeHistoryRef.current;
                  let isReadingScript = false;
                  let readingScoreVal = 0;

                  if (isCalibratedRef.current && readingGuardEnabled && sBuf.length >= 45) {
                    // Look for actual multi-word line progression + sharp return saccades back to the start
                    let returnSaccadesCount = 0;
                    let sustainedRightSweeps = 0;

                    for (let i = 4; i < sBuf.length; i += 2) {
                      const multiFrameDx = sBuf[i].x - sBuf[i - 4].x;
                      
                      // Sustained progressive reading to the right across multiple frames
                      if (multiFrameDx > 0.025) {
                        sustainedRightSweeps++;
                      }
                      // Sharp Return Saccade to the left margin (wrapping to new line)
                      if (multiFrameDx < -0.035) {
                        returnSaccadesCount++;
                      }
                    }

                    readingScoreVal = Math.min(100, Math.round((sustainedRightSweeps * 10) + (returnSaccadesCount * 35)));
                    setReadingScore(readingScoreVal);

                    // Must have AT LEAST 2 verified return saccades + sustained rightward progression
                    if (returnSaccadesCount >= 2 && sustainedRightSweeps >= 3 && readingScoreVal >= 80) {
                      isReadingScript = true;
                    }
                  } else {
                    setReadingScore(0);
                  }

                  // 7. MULTI-VECTOR DECISION RULES (Zero false alarms during normal viewing)
                  const isLookingDown = deltaV > 0.085 || (deltaPitch > 0.08 && deltaV > 0.05);
                  const isLookingUp = deltaV < -0.09;
                  const isLookingLeft = deltaH > 0.14;
                  const isLookingRight = deltaH < -0.14;

                  if (!isCalibratedRef.current) {
                    currentGaze = 'Center';
                  } else if (leftIris.x < 0.03 || rightIris.x > 0.97) {
                    currentGaze = 'Off-Screen';
                  } else if (isLookingDown) {
                    currentGaze = 'Looking Down (Phone Alert)';
                  } else if (isLookingUp) {
                    currentGaze = 'Looking Up';
                  } else if (isReadingScript) {
                    currentGaze = 'Reading Script';
                  } else if (isLookingLeft) {
                    currentGaze = 'Looking Left';
                  } else if (isLookingRight) {
                    currentGaze = 'Looking Right';
                  } else {
                    currentGaze = 'Center';
                  }

                  // 8. RENDER VISUAL RETICLES & DIRECTION RAYS
                  const isViolation = currentGaze !== 'Center';
                  const reticleColor = isViolation ? '#ef4444' : '#10b981';

                  // Eye Corner Baseline Bar
                  ctx.beginPath();
                  ctx.moveTo(leftOuter.x * w, leftOuter.y * h);
                  ctx.lineTo(leftInner.x * w, leftInner.y * h);
                  ctx.moveTo(rightInner.x * w, rightInner.y * h);
                  ctx.lineTo(rightOuter.x * w, rightOuter.y * h);
                  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
                  ctx.lineWidth = 1;
                  ctx.stroke();

                  // Left pupil reticle
                  ctx.strokeStyle = reticleColor;
                  ctx.fillStyle = reticleColor;
                  ctx.lineWidth = 2;
                  ctx.beginPath();
                  ctx.arc(lx, ly, 5, 0, 2 * Math.PI);
                  ctx.stroke();
                  ctx.fillRect(lx - 1.5, ly - 1.5, 3, 3);

                  // Right pupil reticle
                  ctx.beginPath();
                  ctx.arc(rx, ry, 5, 0, 2 * Math.PI);
                  ctx.stroke();
                  ctx.fillRect(rx - 1.5, ry - 1.5, 3, 3);

                  // Gaze Ray Indicator
                  const rayDx = deltaH * 100;
                  const rayDy = deltaV * 240;

                  ctx.beginPath();
                  ctx.moveTo(lx, ly);
                  ctx.lineTo(lx - rayDx, ly + rayDy);
                  ctx.moveTo(rx, ry);
                  ctx.lineTo(rx - rayDx, ry + rayDy);
                  ctx.stroke();

                  // Draw Object Boxes (e.g. Phone)
                  if (detectedObjectsRef.current.length > 0) {
                    detectedObjectsRef.current.forEach(obj => {
                      const [bx, by, bw, bh] = obj.bbox;
                      ctx.strokeStyle = '#ef4444';
                      ctx.lineWidth = 3;
                      ctx.strokeRect(bx, by, bw, bh);

                      ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
                      ctx.fillRect(bx, Math.max(0, by - 22), 160, 22);
                      ctx.fillStyle = '#ffffff';
                      ctx.font = 'bold 11px Inter, sans-serif';
                      ctx.fillText(`🚨 ${obj.class.toUpperCase()} DETECTED`, bx + 6, Math.max(14, by - 6));
                    });
                  }
                } else {
                  // No Face Detected
                  setFaceDetected(false);
                  missingFaceCounter.current++;
                  if (missingFaceCounter.current > 45) {
                    currentGaze = 'Off-Screen';
                    triggerVoiceWarning(
                      'Please position your face directly in front of the camera.',
                      'FACE_NOT_DETECTED',
                      'Candidate face not detected in frame.'
                    );
                  }
                }
              } catch {
                // Frame safety
              }
            }

            setGazeDirection(currentGaze);

            // 9. INSTANT VOICE ALERT DISPATCHERS WITH SUSTAINED DWELL TIME
            if (isCalibratedRef.current) {
              if (currentGaze === 'Looking Down (Phone Alert)') {
                downViolationCounter.current++;
                upViolationCounter.current = 0;
                gazeViolationCounter.current = 0;
                readingViolationCounter.current = 0;

                if (downViolationCounter.current >= 35) { // ~1.2s looking down
                  triggerVoiceWarning(
                    'Please look directly at the screen.',
                    'LOOKING_DOWN_AT_DEVICE',
                    'Candidate eyes directed downward toward phone / secondary screen.'
                  );
                }
              } else if (currentGaze === 'Looking Up') {
                upViolationCounter.current++;
                downViolationCounter.current = 0;
                gazeViolationCounter.current = 0;
                readingViolationCounter.current = 0;

                if (upViolationCounter.current >= 35) {
                  triggerVoiceWarning(
                    'Please look directly at the screen.',
                    'GAZE_OFF_SCREEN',
                    'Candidate eyes directed upward away from the screen.'
                  );
                }
              } else if (currentGaze === 'Reading Script') {
                readingViolationCounter.current++;
                if (readingViolationCounter.current >= 45) { // ~1.5s verified multi-line reading
                  triggerVoiceWarning(
                    'Please look at the screen and speak naturally without reading.',
                    'READING_TELEPROMPTER_SUSPECTED',
                    'Repeated multi-line return saccades detected.'
                  );
                }
              } else if (currentGaze === 'Looking Left' || currentGaze === 'Looking Right' || currentGaze === 'Off-Screen') {
                gazeViolationCounter.current++;
                downViolationCounter.current = 0;
                upViolationCounter.current = 0;
                readingViolationCounter.current = 0;

                if (gazeViolationCounter.current >= 40) {
                  triggerVoiceWarning(
                    'Please keep your eyes focused on the screen.',
                    'GAZE_OFF_SCREEN',
                    `Candidate gaze redirected (${currentGaze}).`
                  );
                }
              } else {
                downViolationCounter.current = 0;
                upViolationCounter.current = 0;
                gazeViolationCounter.current = 0;
                readingViolationCounter.current = 0;
              }
            }
          }
        }
      }

      animationFrameId = requestAnimationFrame(processFrame);
    };

    animationFrameId = requestAnimationFrame(processFrame);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [cameraActive, triggerVoiceWarning, readingGuardEnabled]);

  // Demo Fallback Stream
  const startDemoStream = () => {
    const demoCanvas = document.createElement('canvas');
    demoCanvas.width = 640;
    demoCanvas.height = 480;
    const demoCtx = demoCanvas.getContext('2d');

    let angle = 0;
    const renderDemoFrame = () => {
      if (!demoCtx) return;
      angle += 0.03;

      demoCtx.fillStyle = '#09090b';
      demoCtx.fillRect(0, 0, 640, 480);

      const centerX = 320 + Math.sin(angle) * 50;
      const centerY = 240 + Math.cos(angle * 0.8) * 20;

      demoCtx.fillStyle = '#18181b';
      demoCtx.beginPath();
      demoCtx.ellipse(centerX, centerY, 85, 115, 0, 0, 2 * Math.PI);
      demoCtx.fill();

      // Eyes
      demoCtx.fillStyle = '#10b981';
      demoCtx.beginPath();
      demoCtx.arc(centerX - 30, centerY - 20, 5, 0, 2 * Math.PI);
      demoCtx.arc(centerX + 30, centerY - 20, 5, 0, 2 * Math.PI);
      demoCtx.fill();

      requestAnimationFrame(renderDemoFrame);
    };

    renderDemoFrame();
    const demoStream = demoCanvas.captureStream(30);
    if (videoRef.current) {
      const video = videoRef.current;
      video.srcObject = demoStream;
      video.play().then(() => {
        setCameraActive(true);
        setCameraError(null);
        startCalibration();
      });
    }
  };

  const gazeOk = gazeDirection === 'Center';
  const watching = cameraActive && modelLoaded;
  const headline = !cameraActive
    ? 'Camera is off'
    : isCalibrating
    ? 'Setting up…'
    : phoneDetected
    ? 'Please put your phone away'
    : gazeOk
    ? 'All good'
    : 'Please look at the screen';
  const headlineTone = !cameraActive || phoneDetected || (!gazeOk && !isCalibrating) ? 'text-amber-700' : 'text-emerald-700';

  return (
    <div className="bg-white p-4 rounded-3xl border border-slate-200 text-slate-800 space-y-3 shadow-sm relative overflow-hidden">

      {/* Spoken warning, shown as text too */}
      {activeVoiceToast.visible && (
        <div role="alert" className="absolute top-3 left-3 right-3 z-30 bg-amber-50 text-amber-950 border border-amber-300 p-3 rounded-2xl shadow-lg flex items-start gap-2.5">
          <Volume2 className="w-4 h-4 mt-0.5 shrink-0 text-amber-700" />
          <div className="text-xs leading-snug">
            <strong className="block font-bold">{activeVoiceToast.message}</strong>
            <span className="text-amber-800">Reminder {voiceAlertCount}. The school can see these notes.</span>
          </div>
        </div>
      )}

      {/* The first two seconds: ask the candidate to look at the screen */}
      {isCalibrating && cameraActive && !cameraError && (
        <div className="absolute inset-0 bg-white/90 z-20 flex flex-col items-center justify-center p-6 text-center space-y-3 backdrop-blur-xs">
          <Camera className="w-8 h-8 text-indigo-600" />
          <h4 className="text-sm font-black text-slate-900">Look straight at your screen</h4>
          <p className="text-xs text-slate-600 max-w-xs">Sit comfortably and look at the middle of the screen for two seconds.</p>
          <div className="w-44 bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div className="bg-indigo-600 h-full rounded-full transition-all duration-100" style={{ width: `${calibrationProgress}%` }} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Camera check</p>
          <p className={`text-sm font-black flex items-center gap-1.5 ${headlineTone}`}>
            {headline === 'All good' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {headline}
          </p>
        </div>
        <button
          type="button"
          onClick={startCalibration}
          disabled={!cameraActive}
          title="Use this if you moved your seat or the camera"
          className="shrink-0 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Recheck
        </button>
      </div>

      {/* Camera picture */}
      <div className="relative w-full aspect-[4/3] rounded-2xl bg-slate-900 overflow-hidden border border-slate-200 flex items-center justify-center">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover block" />

        {/* Soft border when they are looking away */}
        {!gazeOk && !isCalibrating && cameraActive && (
          <div className="absolute inset-0 pointer-events-none border-4 border-amber-400 rounded-2xl z-10" />
        )}

        {/* Only when the camera itself is down */}
        {!cameraActive && (
          <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center text-center p-6 space-y-3 text-slate-200 z-20">
            <Camera className="w-8 h-8 mx-auto text-indigo-300" />
            <p className="text-xs font-medium leading-relaxed max-w-xs">{cameraError || 'Starting your camera…'}</p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={startCamera}
                className="px-4 py-2 rounded-xl brand-primary-btn text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Turn on camera
              </button>
              {process.env.NODE_ENV !== 'production' && (
                <button
                  type="button"
                  onClick={startDemoStream}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Demo stream (development only)
                </button>
              )}
            </div>
          </div>
        )}

        {cameraActive && modelWarning && (
          <div className="absolute top-2 left-2 right-2 z-20 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-300 text-[11px] text-amber-900 font-medium">
            {modelWarning}
          </div>
        )}

        {cameraActive && !modelLoaded && !modelWarning && (
          <div className="absolute bottom-2 left-2 z-20 px-2.5 py-1 rounded-lg bg-white/90 border border-slate-200 text-[11px] text-slate-600 font-medium">
            Getting ready…
          </div>
        )}

        <canvas ref={canvasRef} width={640} height={480} className="absolute inset-0 w-full h-full pointer-events-none z-10" />
      </div>

      <ul className="space-y-1.5 text-xs">
        <li className="flex items-center justify-between gap-3">
          <span className="text-slate-500">Camera</span>
          <strong className={cameraActive ? 'text-emerald-700' : 'text-amber-700'}>{cameraActive ? 'On' : 'Off'}</strong>
        </li>
        <li className="flex items-center justify-between gap-3">
          <span className="text-slate-500">Looking at screen</span>
          <strong className={!watching || isCalibrating ? 'text-slate-500' : gazeOk ? 'text-emerald-700' : 'text-amber-700'}>
            {!watching || isCalibrating ? 'Checking…' : gazeOk ? 'Yes' : 'Look at the screen'}
          </strong>
        </li>
        <li className="flex items-center justify-between gap-3">
          <span className="text-slate-500">Other device in view</span>
          <strong className={phoneDetected ? 'text-amber-700' : 'text-emerald-700'}>{phoneDetected ? detectedObjectName || 'Yes' : 'None'}</strong>
        </li>
      </ul>
    </div>
  );
}
