export function ProductThumb({
  src,
  name,
  size = 44,
}: {
  src?: string | null;
  name: string;
  size?: number;
}) {
  return (
    <span className="wo-product-thumb" style={{ width: size, height: size }} title={name}>
      {src ? (
        // AO Cloudinary URLs already fall back to a placeholder photo.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={size} height={size} loading="lazy" referrerPolicy="no-referrer" />
      ) : null}
    </span>
  );
}

export function materialImageUrl(material: { imageUrl?: string | null; product?: { imageUrl?: string | null } | null }) {
  return material.imageUrl || material.product?.imageUrl || "";
}
