import { FileText, MessageSquare, TrendingUp, ChevronRight } from "lucide-react";

export default function GameplayHook() {
  return (
    <section className="gameplay-hook" aria-label="How the game works">
      <div className="hook-step">
        <div className="hook-icon-wrap hook-icon-intel">
          <FileText size={16} strokeWidth={2.4} />
        </div>
        <div className="hook-text">
          <span className="hook-title">1. Secret Intel</span>
          <span className="hook-sub">Get private tips</span>
        </div>
      </div>

      <div className="hook-connector" aria-hidden="true">
        <ChevronRight size={16} strokeWidth={2} />
      </div>

      <div className="hook-step">
        <div className="hook-icon-wrap hook-icon-bluff">
          <MessageSquare size={16} strokeWidth={2.4} />
        </div>
        <div className="hook-text">
          <span className="hook-title">2. Spot the Liar</span>
          <span className="hook-sub">Call out false rumors</span>
        </div>
      </div>

      <div className="hook-connector" aria-hidden="true">
        <ChevronRight size={16} strokeWidth={2} />
      </div>

      <div className="hook-step">
        <div className="hook-icon-wrap hook-icon-trade">
          <TrendingUp size={16} strokeWidth={2.4} />
        </div>
        <div className="hook-text">
          <span className="hook-title">3. Trade & Win</span>
          <span className="hook-sub">Long or short the market</span>
        </div>
      </div>
    </section>
  );
}
