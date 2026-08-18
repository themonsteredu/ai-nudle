import type { ProcessTone } from "@/lib/ramen-process";

export function FactoryMotionScene({ tone, playing = true }: { tone: ProcessTone; playing?: boolean }) {
  return (
    <div className={`factory-motion-scene tone-${tone} ${playing ? "is-playing" : "is-paused"}`} aria-hidden="true">
      <div className="factory-wall-lines" />
      <div className="motion-conveyor"><i /><i /><i /><i /><i /></div>
      {(tone === "mix" || tone === "dough") && (
        <div className="motion-mixer">
          <div className="motion-hopper"><i /><i /><i /><i /></div>
          <div className="motion-mixer-bowl"><span /><b /></div>
        </div>
      )}
      {tone === "noodle" && (
        <div className="motion-roller">
          <span className="roller-one" /><span className="roller-two" />
          <div className="dough-sheet" />
          <div className="noodle-strands"><i /><i /><i /><i /><i /><i /><i /></div>
        </div>
      )}
      {tone === "steam" && (
        <div className="motion-steamer">
          <div className="steam-noodle" />
          <span /><span /><span /><span />
        </div>
      )}
      {tone === "dry" && (
        <div className="motion-dryer">
          <div className="dryer-noodle" />
          <span /><span /><span /><span /><span />
          <b>건조 · 유탕</b>
        </div>
      )}
      {tone === "cool" && (
        <div className="motion-cooler">
          <div className="fan"><i /><i /><i /><i /></div>
          <div className="cool-noodle" />
          <span /><span /><span />
        </div>
      )}
      {tone === "soup" && (
        <div className="motion-soup-line">
          <div className="seasoning-hopper"><i /><i /><i /><i /><i /></div>
          <div className="soup-packet">SPICE</div>
          <div className="topping-packet">FLAKE</div>
        </div>
      )}
      {tone === "pack" && (
        <div className="motion-packer">
          <div className="pack-cup"><span /></div>
          <i className="pack-noodle" /><i className="pack-soup" /><i className="pack-flake" />
        </div>
      )}
      {tone === "check" && (
        <div className="motion-inspector">
          <div className="inspection-product">RAMEN</div>
          <span className="inspection-beam" />
          <div className="inspection-stamp">검사 완료</div>
        </div>
      )}
      <div className="factory-floor" />
    </div>
  );
}
