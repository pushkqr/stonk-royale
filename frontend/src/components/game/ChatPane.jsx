import { Send } from "lucide-react";

export default function ChatPane({ chatFeed, chatInput, setChatInput, sendChat }) {
  return (
    <div
      className="glass-panel"
      style={{ display: "flex", flexDirection: "column" }}
    >
      <h2 className="text-blue mono" style={{ marginBottom: "1rem" }}>
        GLOBAL FEED
      </h2>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          marginBottom: "1rem",
        }}
      >
        {chatFeed.map((msg, i) => (
          <div
            key={i}
            style={{
              background:
                msg.type === "TRADE"
                  ? "rgba(0, 229, 255, 0.1)"
                  : "rgba(0,0,0,0.4)",
              padding: "8px 12px",
              borderRadius: "8px",
              borderLeft:
                msg.type === "TRADE"
                  ? "3px solid var(--accent-blue)"
                  : "none",
            }}
          >
            {msg.type === "TRADE" ? (
              <span className="mono">{msg.message}</span>
            ) : (
              <>
                <strong className="text-secondary">{msg.username}: </strong>
                <span>{msg.text}</span>
              </>
            )}
          </div>
        ))}
      </div>

      <form
        onSubmit={sendChat}
        className="flex-between"
        style={{ gap: "8px" }}
      >
        <input
          type="text"
          className="input-field"
          placeholder="Send a message..."
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
        />
        <button
          type="submit"
          className="btn btn-primary"
          style={{ padding: "14px" }}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
