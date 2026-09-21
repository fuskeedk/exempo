"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { uploadDocumentAction } from "@/app/actions/documents";

export function SignaturePad({
  caseId,
  extraWorkId,
}: {
  caseId: string;
  extraWorkId?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * canvas.width) / rect.width,
      y: ((event.clientY - rect.top) * canvas.height) / rect.height,
    };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const { x, y } = point(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = point(event);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#1a1a18";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  function end() {
    drawing.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  async function save() {
    const canvas = canvasRef.current;
    if (!canvas || !name.trim()) {
      setMessage("Skriv kundens navn, og lad dem underskrive.");
      return;
    }
    setBusy(true);
    setMessage("");
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) {
      setBusy(false);
      setMessage("Kunne ikke gemme underskriften.");
      return;
    }
    const data = new FormData();
    data.set("caseId", caseId);
    data.set("category", "UNDERSKRIFT");
    if (extraWorkId) data.set("extraWorkId", extraWorkId);
    data.set("signerName", name.trim());
    data.set("file", new File([blob], `underskrift-${name.trim()}.png`, { type: "image/png" }));
    try {
      await uploadDocumentAction(data);
      clear();
      setName("");
      setMessage("Underskrift er gemt.");
      router.refresh();
    } catch {
      setMessage("Kunne ikke gemme. Prøv igen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm">
        Kundens navn
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
          placeholder="Navn"
        />
      </label>
      <canvas
        ref={canvasRef}
        width={640}
        height={220}
        className="h-36 w-full touch-none rounded-xl border border-line bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-full bg-rust px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Gemmer…" : extraWorkId ? "Kunden underskriver ekstraarbejde" : "Gem underskrift"}
        </button>
        <button type="button" onClick={clear} className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold">
          Ryd
        </button>
      </div>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </div>
  );
}
