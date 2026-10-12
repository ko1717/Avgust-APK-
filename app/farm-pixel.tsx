import './farm-pixel.css';

export type FarmPixelKind = 'sprout' | 'sun' | 'drop' | 'flower' | 'bee' | 'tractor';

/** Small original pixel scenes. Decorative only; they do not convey the index. */
export default function FarmPixel({kind}: {kind: FarmPixelKind}) {
  return (
    <span className={`fp-pixel is-${kind}`} aria-hidden>
      {kind === 'sprout' && <Sprout />}
      {kind === 'sun' && <Sun />}
      {kind === 'drop' && <Drops />}
      {kind === 'flower' && <Flower />}
      {kind === 'bee' && <Bee />}
      {kind === 'tractor' && <Tractor />}
    </span>
  );
}

function Sprout() {
  return (
    <svg viewBox="0 0 16 16" shapeRendering="crispEdges">
      <rect x="3" y="13" width="10" height="2" fill="#8a5a32" />
      <g className="fp-pixel-grow">
        <rect x="7" y="8" width="2" height="5" fill="#3f8f16" />
        <rect x="4" y="7" width="3" height="2" fill="#5ea318" />
        <rect x="9" y="6" width="3" height="2" fill="#78be20" />
        <rect x="6" y="4" width="4" height="3" fill="#2f7a16" />
      </g>
    </svg>
  );
}

function Sun() {
  return (
    <svg viewBox="0 0 16 16" shapeRendering="crispEdges">
      <g className="fp-pixel-spin">
        <rect x="7" y="0" width="2" height="2" fill="#f2a900" />
        <rect x="7" y="14" width="2" height="2" fill="#f2a900" />
        <rect x="0" y="7" width="2" height="2" fill="#f2a900" />
        <rect x="14" y="7" width="2" height="2" fill="#f2a900" />
        <rect x="2" y="2" width="2" height="2" fill="#e6b000" />
        <rect x="12" y="2" width="2" height="2" fill="#e6b000" />
        <rect x="2" y="12" width="2" height="2" fill="#e6b000" />
        <rect x="12" y="12" width="2" height="2" fill="#e6b000" />
      </g>
      <rect x="5" y="5" width="6" height="6" fill="#ffe08a" />
      <rect x="6" y="6" width="4" height="4" fill="#f2a900" />
    </svg>
  );
}

function Drops() {
  return (
    <svg viewBox="0 0 16 16" shapeRendering="crispEdges">
      <rect className="fp-pixel-drop d1" x="2" y="3" width="2" height="3" fill="#007fa3" />
      <rect className="fp-pixel-drop d2" x="7" y="2" width="2" height="3" fill="#00b5e2" />
      <rect className="fp-pixel-drop d3" x="12" y="4" width="2" height="3" fill="#005f7a" />
    </svg>
  );
}

function Flower() {
  return (
    <svg viewBox="0 0 16 16" shapeRendering="crispEdges">
      <rect x="7" y="9" width="2" height="5" fill="#3f8f16" />
      <rect x="5" y="12" width="2" height="2" fill="#5ea318" />
      <g className="fp-pixel-bloom">
        <rect x="5" y="5" width="2" height="2" fill="#e24b6a" />
        <rect x="9" y="5" width="2" height="2" fill="#e24b6a" />
        <rect x="7" y="3" width="2" height="2" fill="#f28aa0" />
        <rect x="7" y="7" width="2" height="2" fill="#f28aa0" />
        <rect x="7" y="5" width="2" height="2" fill="#f2a900" />
      </g>
    </svg>
  );
}

function Bee() {
  return (
    <svg viewBox="0 0 16 16" shapeRendering="crispEdges">
      <rect x="2" y="5" width="4" height="1" fill="#f7fbfc" />
      <rect x="3" y="4" width="3" height="1" fill="#d7e4e8" />
      <rect x="5" y="7" width="7" height="4" fill="#f2a900" />
      <rect x="7" y="7" width="1" height="4" fill="#1c2428" />
      <rect x="9" y="7" width="1" height="4" fill="#1c2428" />
      <rect x="12" y="8" width="2" height="2" fill="#1c2428" />
    </svg>
  );
}

function Tractor() {
  return (
    <svg viewBox="0 0 32 16" shapeRendering="crispEdges">
      <rect x="0" y="14" width="32" height="2" fill="#c4a574" />
      <rect x="8" y="6" width="12" height="5" fill="#3f8f16" />
      <rect x="14" y="3" width="6" height="4" fill="#e8eef0" />
      <rect x="15" y="4" width="3" height="2" fill="#7ec8ea" />
      <rect x="4" y="8" width="5" height="4" fill="#f2a900" />
      <rect x="5" y="10" width="4" height="4" fill="#1c2428" />
      <rect x="6" y="11" width="2" height="2" fill="#d7e4e8" />
      <rect x="18" y="9" width="5" height="5" fill="#1c2428" />
      <rect x="19" y="10" width="3" height="3" fill="#d7e4e8" />
    </svg>
  );
}
