import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MatchProvider, useMatch } from "../state/MatchProvider";

/**
 * A stand-in for the STOMP client. The provider constructs its own, so the only way to
 * drive it from a test is to replace the module. `bus` is how a test reaches in: it holds
 * the live client, the subscriptions by destination, and everything published.
 */
const bus = { client: null, subs: new Map(), published: [] };

vi.mock("@stomp/stompjs", () => ({
  Client: class {
    constructor(config) {
      Object.assign(this, config);
      this.connected = false;
      this.active = false;
      bus.client = this;
    }
    activate() {
      this.active = true;
      this.connected = true;
      this.onConnect?.();
    }
    deactivate() {
      this.active = false;
      this.connected = false;
    }
    subscribe(destination, handler) {
      bus.subs.set(destination, handler);
      return { unsubscribe: () => bus.subs.delete(destination) };
    }
    publish(frame) {
      bus.published.push(frame);
    }
  },
}));

vi.mock("../lib/api", () => ({
  getLobby: vi.fn(() => Promise.resolve({ code: "ABCDE", players: [] })),
  socketUrl: () => "ws://localhost/api/ws",
}));

vi.mock("../lib/session", () => ({ clearSeat: vi.fn() }));

vi.mock("../lib/sound", () => ({
  sound: {
    bgm: { start: vi.fn(), stop: vi.fn() },
    settle: vi.fn(),
    liquidation: vi.fn(),
    news: vi.fn(),
    chatter: vi.fn(),
    finish: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
    deal: vi.fn(),
    ready: vi.fn(),
    roundStart: vi.fn(),
    stamp: vi.fn(),
  },
}));

const session = { code: "ABCDE", playerId: "p1", token: "t0ken" };

/** Delivers a server message the way the real subscription would. */
function send(destination, payload) {
  const handler = bus.subs.get(destination);
  if (!handler) throw new Error(`nothing subscribed to ${destination}`);
  act(() => handler({ body: JSON.stringify(payload) }));
}

const topic = (channel) => `/topic/match/ABCDE/${channel}`;

/** Renders whatever the context holds, so assertions read off the DOM. */
function Probe() {
  const m = useMatch();
  return (
    <div>
      <span data-testid="connected">{String(m.connected)}</span>
      <span data-testid="rounds">{m.roundHistory.length}</span>
      <span data-testid="settled">{m.settled ? m.settled.roundIndex : "none"}</span>
      <span data-testid="board">{m.board.length}</span>
      <span data-testid="phase">{m.phase?.phase ?? "none"}</span>
      <button type="button" onClick={() => m.say("hello")}>
        say
      </button>
    </div>
  );
}

async function mount() {
  let result;
  await act(async () => {
    result = render(
      <MatchProvider session={session}>
        <Probe />
      </MatchProvider>,
    );
  });
  return result;
}

describe("MatchProvider", () => {
  beforeEach(() => {
    bus.client = null;
    bus.subs = new Map();
    bus.published = [];
  });

  it("connects and subscribes to every match topic", async () => {
    await mount();

    expect(screen.getByTestId("connected").textContent).toBe("true");

    const expectedTopics = [
      topic("phase"),
      topic("price"),
      topic("board"),
      topic("standings"),
      topic("lobby"),
      topic("ready"),
      topic("feed"),
      topic("settled"),
      "/user/queue/rumor",
      "/user/queue/error",
      "/user/queue/kicked",
    ];

    for (const top of expectedTopics) {
      expect(bus.subs.has(top)).toBe(true);
    }
  });

  it("accumulates one entry in roundHistory per settled round", async () => {
    await mount();

    send(topic("settled"), { roundIndex: 0, results: [] });
    send(topic("settled"), { roundIndex: 1, results: [] });

    expect(screen.getByTestId("rounds").textContent).toBe("2");
    expect(screen.getByTestId("settled").textContent).toBe("1");
  });

  it("ignores a settled round it has already recorded", async () => {
    await mount();

    send(topic("settled"), { roundIndex: 0, results: [] });
    send(topic("settled"), { roundIndex: 0, results: [] });

    expect(screen.getByTestId("rounds").textContent).toBe("1");
    expect(screen.getByTestId("settled").textContent).toBe("0");
  });

  it("clears match state when the room returns to the lobby", async () => {
    await mount();

    send(topic("settled"), { roundIndex: 0, results: [] });
    send(topic("board"), [{ playerId: "p1", nickname: "Alice" }]);

    expect(screen.getByTestId("rounds").textContent).toBe("1");
    expect(screen.getByTestId("settled").textContent).toBe("0");
    expect(screen.getByTestId("board").textContent).toBe("1");

    send(topic("phase"), {
      phase: "LOBBY",
      roundIndex: 0,
      serverTime: Date.now(),
      endsAtMillis: Date.now() + 60000,
    });

    expect(screen.getByTestId("rounds").textContent).toBe("0");
    expect(screen.getByTestId("settled").textContent).toBe("none");
    expect(screen.getByTestId("board").textContent).toBe("0");
  });

  it("publishes a chat action when connected", async () => {
    await mount();

    act(() => {
      screen.getByRole("button", { name: "say" }).click();
    });

    const chatFrame = bus.published.find((f) => f.destination === "/app/match/ABCDE/chat");
    expect(chatFrame).toBeDefined();

    const parsed = JSON.parse(chatFrame.body);
    expect(parsed.text).toBe("hello");
  });

  it("does not publish while the socket is down", async () => {
    await mount();

    bus.client.connected = false;
    const initialCount = bus.published.length;

    act(() => {
      screen.getByRole("button", { name: "say" }).click();
    });

    expect(bus.published.length).toBe(initialCount);
  });
});
