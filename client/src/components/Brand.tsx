export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand--compact" : ""}`} aria-label="Rosco">
      <span className="brand__mark" aria-hidden="true">R</span>
      <span className="brand__name">ROSCO</span>
    </div>
  );
}

