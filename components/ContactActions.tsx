"use client";

import { appleMapsUrl, countryLabel, formatPlace, googleMapsSearchUrl, mailHref, telHref } from "@/lib/geo";

export function PhoneLink({
  phone,
  className,
}: {
  phone: string;
  className?: string;
}) {
  const href = telHref(phone);
  if (!href) return phone ? <span>{phone}</span> : null;
  return (
    <a href={href} className={className}>
      {phone}
    </a>
  );
}

export function MailLink({
  email,
  className,
}: {
  email: string;
  className?: string;
}) {
  const href = mailHref(email);
  if (!href) return email ? <span>{email}</span> : null;
  return (
    <a href={href} className={className}>
      {email}
    </a>
  );
}

export function MapButton({
  address,
  className = "wo-map-link",
  children = "Vis på kort",
}: {
  address: string;
  className?: string;
  children?: string;
}) {
  const place = address.trim();
  const href = googleMapsSearchUrl(place);
  if (!href) return null;
  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        if (/iPad|iPhone|iPod/i.test(navigator.userAgent)) {
          event.preventDefault();
          window.location.href = appleMapsUrl(place);
        }
      }}
    >
      {children}
    </a>
  );
}

export function CallButton({
  phone,
  className,
  children = "Ring op",
}: {
  phone: string;
  className?: string;
  children?: string;
}) {
  const href = telHref(phone);
  if (!href) return null;
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

export function ContactBlock({
  kicker = "Kontaktadresse",
  attn,
  name,
  street,
  postal,
  city,
  country,
  email,
  phone,
}: {
  kicker?: string;
  attn?: string | null;
  name?: string;
  street?: string | null;
  postal?: string | null;
  city?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  const place = formatPlace([street, postal, city]);
  return (
    <div className="wo-contact">
      <div className="wo-contact-addr">
        <p className="wo-contact-kicker">{kicker}</p>
        {attn && attn !== name ? <p>{attn}</p> : null}
        {name ? <p>{name}</p> : null}
        {street ? <p>{street}</p> : null}
        {postal || city ? <p>{[postal, city].filter(Boolean).join(" ")}</p> : null}
        {place ? <p>{countryLabel(country)}</p> : null}
        {!place && !name ? <p>—</p> : null}
      </div>
      {email ? (
        <p className="wo-contact-row">
          <span>Mail</span>
          <MailLink email={email} />
        </p>
      ) : null}
      {phone ? (
        <p className="wo-contact-row">
          <span>Telefon</span>
          <PhoneLink phone={phone} />
        </p>
      ) : null}
      <MapButton address={place} />
    </div>
  );
}
