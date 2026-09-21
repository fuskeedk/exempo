export function WorkOrderDonut({
  slices,
  size = 72,
}: {
  slices: Array<{ value: number; color: string }>;
  size?: number;
}) {
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);
  let acc = 0;
  const items =
    total <= 0
      ? [{ color: "#ececec", dash: 100, offset: 25 }]
      : slices
          .filter((slice) => slice.value > 0)
          .map((slice) => {
            const dash = (slice.value / total) * 100;
            const item = { color: slice.color, dash, offset: 25 - acc };
            acc += dash;
            return item;
          });

  return (
    <svg width={size} height={size} viewBox="0 0 42 42" className="wo-donut" aria-hidden>
      <circle cx="21" cy="21" r="15.9155" fill="transparent" stroke="#f3f3f3" strokeWidth="8" />
      {items.map((item, index) => (
        <circle
          key={`${item.color}-${index}`}
          cx="21"
          cy="21"
          r="15.9155"
          fill="transparent"
          stroke={item.color}
          strokeWidth="8"
          strokeDasharray={`${item.dash} ${100 - item.dash}`}
          strokeDashoffset={item.offset}
        />
      ))}
    </svg>
  );
}
