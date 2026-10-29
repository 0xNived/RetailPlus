export default function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="retail-brand">
      <img
        src="/brand/retailplus-cart-plus.png"
        alt=""
        width="42"
        height="42"
      />
      {!compact && (
        <span>
          Retail<span className="retail-brand-plus">Plus</span>
        </span>
      )}
    </span>
  );
}
