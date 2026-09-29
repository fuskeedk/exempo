"use client";

import { useEffect, useState } from "react";
import { smsComposeHref } from "@/lib/sms";

const linkClass =
  "inline-flex items-center justify-center rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink";

export function CustomerSms({
  phone,
  idag,
  paaVej,
}: {
  phone: string;
  idag: string;
  paaVej: string;
}) {
  const [ios, setIos] = useState(false);
  useEffect(() => {
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent));
  }, []);
  if (!phone.trim()) return null;
  const todayHref = smsComposeHref(phone, idag, ios);
  const wayHref = smsComposeHref(phone, paaVej, ios);
  if (!todayHref || !wayHref) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <a className={linkClass} href={todayHref}>
        I dag
      </a>
      <a className={linkClass} href={wayHref}>
        På vej
      </a>
    </div>
  );
}
