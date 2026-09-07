import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BY_ID,
  CARD_H,
  CARD_W,
  CHILDREN,
  PEOPLE,
  WORLD,
  ancestorsOf,
  depthOf,
  journeyFor,
  logoUrl,
  type Person,
} from "@/data/org";

type Cam = { x: number; y: number; s: number };

const MIN_S = 0.22;
const MAX_S = 2.6;

function clamp(v: number, a: number, b: number) {
  return Math.min(b, Math.max(a, v));
}

function edgePath(p: Person, c: Person) {
  const px = p.x;
  const py = p.y + CARD_H / 2;
  const cx = c.x;
  const cy = c.y - CARD_H / 2;
  const my = py + (cy - py) * 0.55;
  if (Math.abs(cx - px) < 2) return `M ${px} ${py} L ${cx} ${cy}`;
  const dir = cx > px ? 1 : -1;
  const r = Math.min(22, Math.abs(cx - px) / 2, Math.abs(my - py), Math.abs(cy - my));
  return [
    `M ${px} ${py}`,
    `V ${my - r}`,
    `Q ${px} ${my} ${px + r * dir} ${my}`,
    `H ${cx - r * dir}`,
    `Q ${cx} ${my} ${cx} ${my + r}`,
    `V ${cy}`,
  ].join(" ");
}

const EDGES = PEOPLE.filter((p) => p.parent).map((p) => {
  const parent = BY_ID[p.parent as string] as Person;
  return { id: `${parent.id}-${p.id}`, from: parent.id, to: p.id, d: edgePath(parent, p) };
});

export default function OrgCanvas() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const miniRef = useRef<SVGRectElement | null>(null);

  const cam = useRef<Cam>({ x: 0, y: 0, s: 0.4 });
  const target = useRef<Cam>({ x: 0, y: 0, s: 0.4 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinch = useRef<{ dist: number; s: number } | null>(null);
  const dragging = useRef(false);
  const moved = useRef(0);
  const last = useRef({ x: 0, y: 0 });

  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [lod, setLod] = useState<"far" | "mid" | "near">("far");
  const [mounted, setMounted] = useState(false);
  const [touched, setTouched] = useState(false);
  const [journey, setJourney] = useState<{ chain: string[]; i: number } | null>(null);

  const active = selected ?? hovered;

  const related = useMemo(() => {
    if (!active) return null;
    const set = new Set<string>([active]);
    const p = BY_ID[active];
    if (p?.parent) set.add(p.parent);
    (CHILDREN[active] ?? []).forEach((c) => set.add(c));
    return set;
  }, [active]);

  const activeEdges = useMemo(() => {
    if (!active) return new Set<string>();
    const s = new Set<string>();
    EDGES.forEach((e) => {
      if (e.to === active || e.from === active) s.add(e.id);
    });
    return s;
  }, [active]);

  const fit = useCallback((animate = true) => {
    const el = viewportRef.current;
    if (!el) return;
    const pad = 120;
    const s = clamp(
      Math.min((el.clientWidth - pad) / WORLD.w, (el.clientHeight - pad) / WORLD.h),
      MIN_S,
      MAX_S,
    );
    const t = {
      s,
      x: (el.clientWidth - WORLD.w * s) / 2,
      y: (el.clientHeight - WORLD.h * s) / 2,
    };
    target.current = t;
    if (!animate) cam.current = { ...t };
  }, []);

  const focusOn = useCallback((id: string, scale?: number) => {
    const el = viewportRef.current;
    const p = BY_ID[id];
    if (!el || !p) return;
    const s = clamp(scale ?? Math.max(0.85, cam.current.s), MIN_S, MAX_S);
    target.current = {
      s,
      x: el.clientWidth / 2 - p.x * s,
      y: el.clientHeight / 2 - p.y * s - (el.clientHeight < 700 ? 40 : 60),
    };
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const el = viewportRef.current;
    if (!el) return;
    const t = target.current;
    const s = clamp(t.s * factor, MIN_S, MAX_S);
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    const k = s / t.s;
    target.current = { s, x: cx - (cx - t.x) * k, y: cy - (cy - t.y) * k };
  }, []);

  // camera loop
  useEffect(() => {
    let raf = 0;
    let tier: "far" | "mid" | "near" = "far";
    const loop = () => {
      const c = cam.current;
      const t = target.current;
      const e = dragging.current ? 1 : 0.14;
      c.x += (t.x - c.x) * e;
      c.y += (t.y - c.y) * e;
      c.s += (t.s - c.s) * e;
      const stage = stageRef.current;
      if (stage) {
        stage.style.transform = `translate3d(${c.x.toFixed(2)}px, ${c.y.toFixed(2)}px, 0) scale(${c.s.toFixed(4)})`;
      }
      const vp = viewportRef.current;
      if (vp && miniRef.current) {
        miniRef.current.setAttribute("x", String(-c.x / c.s));
        miniRef.current.setAttribute("y", String(-c.y / c.s));
        miniRef.current.setAttribute("width", String(vp.clientWidth / c.s));
        miniRef.current.setAttribute("height", String(vp.clientHeight / c.s));
      }
      const next = c.s < 0.5 ? "far" : c.s < 0.95 ? "mid" : "near";
      if (next !== tier) {
        tier = next;
        setLod(next);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // intro + initial fit
  useEffect(() => {
    fit(false);
    const el = viewportRef.current;
    if (el) {
      cam.current = { ...target.current, s: target.current.s * 0.86 };
    }
    const t = window.setTimeout(() => setMounted(true), 120);
    const onResize = () => fit(true);
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, [fit]);

  // wheel zoom (non-passive)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setTouched(true);
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const t = target.current;
      const s = clamp(t.s * Math.exp(-dy * 0.0016), MIN_S, MAX_S);
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const k = s / t.s;
      target.current = { s, x: px - (px - t.x) * k, y: py - (py - t.y) * k };
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      if (a && b) pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), s: target.current.s };
      dragging.current = false;
      return;
    }
    dragging.current = true;
    moved.current = 0;
    last.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const el = viewportRef.current;
    if (!el) return;

    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const rect = el.getBoundingClientRect();
      const mx = (a.x + b.x) / 2 - rect.left;
      const my = (a.y + b.y) / 2 - rect.top;
      const t = target.current;
      const s = clamp(pinch.current.s * (dist / pinch.current.dist), MIN_S, MAX_S);
      const k = s / t.s;
      target.current = { s, x: mx - (mx - t.x) * k, y: my - (my - t.y) * k };
      setTouched(true);
      return;
    }

    if (!dragging.current) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    moved.current += Math.abs(dx) + Math.abs(dy);
    if (moved.current > 6) setTouched(true);
    target.current = { ...target.current, x: target.current.x + dx, y: target.current.y + dy };
    cam.current.x += dx;
    cam.current.y += dy;
  };

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) dragging.current = false;
  };

  const select = useCallback(
    (id: string) => {
      setTouched(true);
      setSelected(id);
      setJourney({ chain: journeyFor(id), i: journeyFor(id).indexOf(id) });
      const p = BY_ID[id];
      focusOn(id, p?.tier === "house" ? 1.35 : 1.15);
    },
    [focusOn],
  );

  const stepJourney = useCallback(() => {
    setJourney((j) => {
      if (!j) return j;
      const i = (j.i + 1) % j.chain.length;
      const id = j.chain[i];
      if (id) {
        setSelected(id);
        focusOn(id, 1.15);
      }
      return { ...j, i };
    });
  }, [focusOn]);

  const reset = useCallback(() => {
    setSelected(null);
    setJourney(null);
    fit(true);
  }, [fit]);

  const onMiniClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const el = viewportRef.current;
    const svg = e.currentTarget;
    if (!el) return;
    const r = svg.getBoundingClientRect();
    const wx = ((e.clientX - r.left) / r.width) * WORLD.w;
    const wy = ((e.clientY - r.top) / r.height) * WORLD.h;
    const s = target.current.s;
    target.current = { s, x: el.clientWidth / 2 - wx * s, y: el.clientHeight / 2 - wy * s };
    setTouched(true);
  };

  const sel = selected ? BY_ID[selected] : null;
  const selParent = sel?.parent ? BY_ID[sel.parent] : null;
  const selKids = (selected ? (CHILDREN[selected] ?? []) : []).map((id) => BY_ID[id] as Person);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-canvas text-cream">
      <div className="pointer-events-none absolute inset-0 z-0 bg-leaf opacity-[0.55]" />
      <div className="pointer-events-none absolute inset-0 z-0 bg-vignette" />

      {/* masthead */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-4 p-5 sm:p-8">
        <div className="flex items-center gap-3 sm:gap-4">
          <img src={logoUrl} alt="Lift Greenwood emblem" className="h-10 w-10 sm:h-12 sm:w-12" />
          <div>
            <p className="font-display text-lg leading-none tracking-tight sm:text-2xl">
              Lift Greenwood
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.32em] text-cream/55 sm:text-xs">
              Organisation Map
            </p>
          </div>
        </div>
        <button onClick={reset} className="pointer-events-auto btn-ghost">
          View whole organisation
        </button>
      </header>

      {/* canvas */}
      <div
        ref={viewportRef}
        className="absolute inset-0 z-10 touch-none select-none"
        style={{ cursor: dragging.current ? "grabbing" : "grab" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={endPointer}
      >
        <div
          ref={stageRef}
          className="absolute left-0 top-0 origin-top-left will-change-transform"
          style={{ width: WORLD.w, height: WORLD.h }}
        >
          <svg
            className="pointer-events-none absolute left-0 top-0 overflow-visible"
            width={WORLD.w}
            height={WORLD.h}
          >
            {EDGES.map((e) => {
              const isActive = activeEdges.has(e.id);
              const dim = !!active && !isActive;
              const d = depthOf(e.to);
              return (
                <g key={e.id}>
                  <path
                    d={e.d}
                    className={`edge ${mounted ? "edge-in" : ""} ${dim ? "opacity-20" : ""}`}
                    style={{ animationDelay: `${260 + d * 280}ms` }}
                  />
                  {isActive && <path d={e.d} className="edge-pulse" />}
                </g>
              );
            })}
          </svg>

          {PEOPLE.map((p) => {
            const d = depthOf(p.id);
            const isSel = selected === p.id;
            const dim = !!active && !related?.has(p.id);
            const isHouse = p.tier === "house";
            return (
              <div
                key={p.id}
                className="absolute"
                style={{
                  left: p.x - CARD_W / 2,
                  top: p.y - CARD_H / 2,
                  width: CARD_W,
                  height: CARD_H,
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? "none" : "translateY(18px) scale(0.94)",
                  transition: `opacity .7s cubic-bezier(.2,.7,.2,1) ${d * 280}ms, transform .8s cubic-bezier(.2,.7,.2,1) ${d * 280}ms`,
                }}
              >
                <div
                  className="float-slow h-full w-full"
                  style={{ animationDelay: `${(p.x % 7) * 0.9}s`, animationDuration: `${9 + (p.y % 5)}s` }}
                >
                  <button
                    onMouseEnter={() => setHovered(p.id)}
                    onMouseLeave={() => setHovered((h) => (h === p.id ? null : h))}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      if (moved.current > 6) return;
                      select(p.id);
                    }}
                    className={`node ${p.tier} ${isSel ? "is-selected" : ""} ${dim ? "is-dim" : ""}`}
                    style={
                      isHouse
                        ? ({
                            "--house": p.houseColor,
                            "--house-ink": p.houseInk,
                          } as React.CSSProperties)
                        : undefined
                    }
                  >
                    <span className="node-photo">
                      <img src={p.photo} alt={p.name} draggable={false} loading="lazy" />
                    </span>
                    <span className="node-body">
                      <span className="node-name">{p.name}</span>
                      {lod !== "far" && <span className="node-title">{p.title}</span>}
                      {lod === "near" && <span className="node-focus">{p.focus}</span>}
                    </span>
                    {isHouse && <span className="house-dot" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* hints */}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-8 z-20 flex justify-center transition-opacity duration-700 ${
          touched ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 rounded-full border border-cream/12 bg-ink/40 px-6 py-2.5 text-[11px] uppercase tracking-[0.28em] text-cream/60 backdrop-blur">
          <span className="hint-pulse">Drag to explore</span>
          <span className="hint-pulse" style={{ animationDelay: ".4s" }}>
            Scroll to zoom
          </span>
          <span className="hint-pulse" style={{ animationDelay: ".8s" }}>
            Select a person
          </span>
        </div>
      </div>

      {/* zoom controls */}
      <div className="absolute right-5 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2 sm:flex">
        <button className="ctl" onClick={() => zoomBy(1.35)} aria-label="Zoom in">
          +
        </button>
        <button className="ctl" onClick={() => zoomBy(1 / 1.35)} aria-label="Zoom out">
          –
        </button>
        <button className="ctl text-[10px] tracking-widest" onClick={reset} aria-label="Reset view">
          FIT
        </button>
      </div>

      {/* minimap */}
      <div
        className={`absolute bottom-5 right-5 z-30 transition-all duration-500 ${
          lod === "far" ? "pointer-events-none translate-y-3 opacity-0" : "opacity-100"
        }`}
      >
        <svg
          onClick={onMiniClick}
          viewBox={`0 0 ${WORLD.w} ${WORLD.h}`}
          className="h-[104px] w-[168px] cursor-pointer rounded-lg border border-cream/15 bg-ink/60 backdrop-blur sm:h-[132px] sm:w-[210px]"
        >
          {EDGES.map((e) => (
            <path key={e.id} d={e.d} fill="none" stroke="rgba(233,241,225,.22)" strokeWidth={6} />
          ))}
          {PEOPLE.map((p) => (
            <circle
              key={p.id}
              cx={p.x}
              cy={p.y}
              r={selected === p.id ? 48 : 30}
              fill={p.houseColor ?? (selected === p.id ? "#c6f24e" : "rgba(233,241,225,.7)")}
            />
          ))}
          <rect
            ref={miniRef}
            fill="rgba(198,242,78,.12)"
            stroke="#c6f24e"
            strokeWidth={8}
            rx={14}
          />
        </svg>
      </div>

      {/* person panel */}
      <div
        className={`pointer-events-none absolute inset-x-4 bottom-4 z-30 flex justify-start transition-all duration-500 sm:inset-x-auto sm:left-8 sm:top-1/2 sm:-translate-y-1/2 ${
          sel ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
        }`}
      >
        {sel && (
          <div className="pointer-events-auto panel">
            <div className="flex items-start gap-4">
              <img src={sel.photo} alt={sel.name} className="panel-photo" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.3em] text-lime/80">{sel.title}</p>
                <h2 className="mt-1 font-display text-2xl leading-tight">{sel.name}</h2>
                <p className="mt-1 text-sm text-cream/65">{sel.focus}</p>
              </div>
            </div>

            <div className="mt-5 space-y-3 border-t border-cream/10 pt-4 text-sm">
              {selParent && (
                <div>
                  <p className="lbl">Reports to</p>
                  <button className="lnk" onClick={() => select(selParent.id)}>
                    {selParent.name} · {selParent.title}
                  </button>
                </div>
              )}
              {selKids.length > 0 && (
                <div>
                  <p className="lbl">Direct reports</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {selKids.map((k) => (
                      <button key={k.id} className="chip" onClick={() => select(k.id)}>
                        {k.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {sel.house && (
                <div>
                  <p className="lbl">House</p>
                  <p className="mt-1 flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: sel.houseColor }}
                    />
                    {sel.house} House
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center gap-2">
              <button className="btn-solid" onClick={stepJourney}>
                Explore connection →
              </button>
              <button className="btn-ghost" onClick={reset}>
                Back out
              </button>
            </div>
            {journey && (
              <p className="mt-3 text-[10px] uppercase tracking-[0.24em] text-cream/40">
                Step {journey.i + 1} of {journey.chain.length} ·{" "}
                {journey.chain.map((id) => BY_ID[id]?.name.split(" ")[0]).join(" → ")}
              </p>
            )}
          </div>
        )}
      </div>

      {/* houses strip */}
      <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 hidden -translate-x-1/2 items-center gap-2 sm:flex">
        {PEOPLE.filter((p) => p.tier === "house").map((h) => (
          <button
            key={h.id}
            className="pointer-events-auto house-pill"
            style={{ "--house": h.houseColor } as React.CSSProperties}
            onMouseEnter={() => setHovered(h.id)}
            onMouseLeave={() => setHovered((v) => (v === h.id ? null : v))}
            onClick={() => select(h.id)}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: h.houseColor }} />
            {h.house}
          </button>
        ))}
        <span className="ml-2 text-[10px] uppercase tracking-[0.3em] text-cream/35">
          
        </span>
      </div>
    </div>
  );
}

export function ancestorsLabel(id: string) {
  return ancestorsOf(id)
    .map((a) => BY_ID[a]?.name)
    .join(" → ");
}
