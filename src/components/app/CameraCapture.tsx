'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from './ui';

/**
 * Live camera capture for scanning a receipt. Opens the device camera via
 * getUserMedia (rear camera on phones, webcam on desktop), shows a viewfinder,
 * and returns the captured frame as an image File. Falls back gracefully when
 * no camera is available or permission is denied — the caller can offer Upload.
 */
export function CameraCapture({
  onCapture,
  onClose,
  onUploadInstead,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
  onUploadInstead: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser can’t open the camera. Upload a photo instead.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch (e) {
        const name = e instanceof DOMException ? e.name : '';
        setError(
          name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow it in your browser, or upload a photo instead.'
            : name === 'NotFoundError'
              ? 'No camera found on this device. Upload a photo instead.'
              : 'Couldn’t open the camera. Upload a photo instead.'
        );
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stop = () => streamRef.current?.getTracks().forEach((t) => t.stop());

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stop();
        onCapture(new File([blob], `receipt-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.92
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-semibold">Scan receipt</span>
        <button
          onClick={() => {
            stop();
            onClose();
          }}
          aria-label="Close"
          className="rounded-lg px-3 py-1 text-sm text-white/80 hover:bg-white/10"
        >
          ✕
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
        />
        {/* framing guide */}
        {ready && !error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[70%] w-[82%] rounded-2xl border-2 border-white/70" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900 px-6 text-center">
            <p className="max-w-xs text-sm text-slate-200">{error}</p>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  stop();
                  onUploadInstead();
                }}
              >
                Upload a photo
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  stop();
                  onClose();
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {!error && (
        <div className="flex items-center justify-center gap-6 bg-black px-4 py-5">
          <button
            onClick={() => {
              stop();
              onUploadInstead();
            }}
            className="text-xs font-medium text-white/70 hover:text-white"
          >
            Upload instead
          </button>
          <button
            onClick={capture}
            disabled={!ready}
            aria-label="Take photo"
            className="grid h-16 w-16 place-items-center rounded-full bg-white ring-4 ring-white/30 disabled:opacity-50"
          >
            <span className="h-12 w-12 rounded-full bg-white ring-2 ring-slate-300" />
          </button>
          <span className="w-16" />
        </div>
      )}
    </div>
  );
}
