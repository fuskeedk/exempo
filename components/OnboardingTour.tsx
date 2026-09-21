"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { completeTourAction } from "@/app/actions/tour";
import type { Role } from "@/lib/catalog";
import { pathMatchesTour, tourSteps } from "@/lib/tour";

type Rect = { top: number; left: number; width: number; height: number };

const TOUR_EVENT = "exempo:tour";

function readRect(el: Element): Rect {
  const box = el.getBoundingClientRect();
  return { top: box.top, left: box.left, width: box.width, height: box.height };
}

function padRect(rect: Rect, pad: number): Rect {
  return {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
}

export function OnboardingTour({
  autoStart,
  role,
  companyName,
  userName,
}: {
  autoStart: boolean;
  role: Role;
  companyName: string;
  userName: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const steps = useMemo(() => tourSteps(role, companyName, userName), [role, companyName, userName]);
  const [open, setOpen] = useState(autoStart);
  const [step, setStep] = useState(0);
  const [spot, setSpot] = useState<Rect | null>(null);
  const [saving, setSaving] = useState(false);

  const current = steps[Math.min(step, steps.length - 1)];
  const last = step >= steps.length - 1;

  const finish = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setOpen(false);
    try {
      await completeTourAction();
    } finally {
      setSaving(false);
      setStep(0);
    }
  }, [saving]);

  const start = useCallback(() => {
    setStep(0);
    setOpen(true);
  }, []);

  useEffect(() => {
    const onStart = () => start();
    window.addEventListener(TOUR_EVENT, onStart);
    return () => window.removeEventListener(TOUR_EVENT, onStart);
  }, [start]);

  useEffect(() => {
    if (!open || !current?.href) return;
    if (!pathMatchesTour(pathname, current.href, current.exact)) {
      router.push(current.href);
    }
  }, [open, current, pathname, router]);

  useEffect(() => {
    if (!open) {
      setSpot(null);
      return;
    }

    let didScroll = false;
    const measure = () => {
      if (current.openCreate) {
        const menu = document.querySelector<HTMLDetailsElement>("[data-tour='nav-opret']");
        if (menu) menu.open = true;
      } else {
        const menu = document.querySelector<HTMLDetailsElement>("[data-tour='nav-opret']");
        if (menu) menu.open = false;
      }
      if (!current.target) {
        setSpot(null);
        return;
      }
      const el = document.querySelector(`[data-tour='${current.target}']`);
      if (!el) {
        setSpot(null);
        return;
      }
      if (!didScroll) {
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
        didScroll = true;
      }
      setSpot(padRect(readRect(el), 8));
    };

    measure();
    const interval = window.setInterval(measure, 160);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const stop = window.setTimeout(() => window.clearInterval(interval), 2800);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(stop);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, current, pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        void finish();
      }
      if (event.key === "ArrowRight" || event.key === "Enter") {
        event.preventDefault();
        if (last) void finish();
        else setStep((n) => Math.min(n + 1, steps.length - 1));
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setStep((n) => Math.max(0, n - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, last, steps.length, finish]);

  if (!open || !current) return null;

  return (
    <div className="tour-root no-print" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <button type="button" className="tour-scrim" aria-label="Luk rundvisning" onClick={() => void finish()} />
      {spot ? (
        <div
          className="tour-spot"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
          }}
        />
      ) : null}
      <aside className="tour-card" style={cardPosition(spot)}>
        <p className="tour-kicker">
          {step + 1} / {steps.length}
        </p>
        <h2 id="tour-title">{current.title}</h2>
        <p>{current.body}</p>
        <div className="tour-actions">
          <button type="button" className="tour-skip" onClick={() => void finish()}>
            Spring over
          </button>
          <div className="tour-nav">
            {step > 0 ? (
              <button type="button" className="tour-back" onClick={() => setStep((n) => n - 1)}>
                Tilbage
              </button>
            ) : null}
            <button
              type="button"
              className="tour-next"
              onClick={() => {
                if (last) void finish();
                else setStep((n) => n + 1);
              }}
            >
              {last ? "Færdig" : "Næste"}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

export function TourHelpButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(TOUR_EVENT))}>
      Vis rundvisning
    </button>
  );
}

function cardPosition(spot: Rect | null): CSSProperties {
  const width = 360;
  const margin = 16;
  if (typeof window === "undefined") {
    return { left: "50%", top: "50%", transform: "translate(-50%, -50%)", width };
  }
  if (!spot) {
    return { left: "50%", top: "50%", transform: "translate(-50%, -50%)", width };
  }
  const spaceRight = window.innerWidth - (spot.left + spot.width);
  const spaceBottom = window.innerHeight - (spot.top + spot.height);
  if (spaceRight > width + 24) {
    return {
      left: Math.min(spot.left + spot.width + 16, window.innerWidth - width - margin),
      top: Math.min(Math.max(margin, spot.top), window.innerHeight - 280),
      width,
    };
  }
  if (spaceBottom > 240) {
    return {
      left: Math.min(Math.max(margin, spot.left), window.innerWidth - width - margin),
      top: spot.top + spot.height + 16,
      width,
    };
  }
  return {
    left: Math.min(Math.max(margin, spot.left), window.innerWidth - width - margin),
    top: Math.max(margin, spot.top - 220),
    width,
  };
}
