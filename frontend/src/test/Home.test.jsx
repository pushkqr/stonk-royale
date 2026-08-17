import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Home from "../pages/Home";
import * as api from "../lib/api";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../lib/api", () => ({
  createMatch: vi.fn(),
  joinMatch: vi.fn(),
  practiceMatch: vi.fn(),
  quickMatch: vi.fn(),
}));

vi.mock("../lib/session", () => ({
  saveSeat: vi.fn(),
}));

describe("Home.jsx Tabbed Switcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Play / Join as the default tab with Find a Game button", () => {
    render(<Home />);

    const playTab = screen.getByRole("tab", { name: /Play \/ Join/i });
    const hostTab = screen.getByRole("tab", { name: /Host Lobby/i });

    expect(playTab).toHaveClass("is-active");
    expect(hostTab).not.toHaveClass("is-active");

    expect(screen.getByRole("button", { name: /Find a Game/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("CODE")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Create Lobby/i })).not.toBeInTheDocument();
  });

  it("switches to Host Lobby tab and displays preset options", () => {
    render(<Home />);

    const hostTab = screen.getByRole("tab", { name: /Host Lobby/i });
    fireEvent.click(hostTab);

    expect(hostTab).toHaveClass("is-active");
    expect(screen.getByRole("button", { name: /Create Lobby/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Whale Wars/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Find a Game/i })).not.toBeInTheDocument();
  });

  it("persists nickname across tab switches", () => {
    render(<Home />);

    const nameInput = screen.getByPlaceholderText("what should they call you");
    fireEvent.change(nameInput, { target: { value: "CryptoKing" } });
    expect(nameInput.value).toBe("CryptoKing");

    const hostTab = screen.getByRole("tab", { name: /Host Lobby/i });
    fireEvent.click(hostTab);
    expect(screen.getByPlaceholderText("what should they call you").value).toBe("CryptoKing");

    const playTab = screen.getByRole("tab", { name: /Play \/ Join/i });
    fireEvent.click(playTab);
    expect(screen.getByPlaceholderText("what should they call you").value).toBe("CryptoKing");
  });

  it("triggers quickMatch on Find a Game button click", async () => {
    api.quickMatch.mockResolvedValueOnce({ code: "GAME1", playerId: "p1", token: "tok1" });

    render(<Home />);
    const nameInput = screen.getByPlaceholderText("what should they call you");
    fireEvent.change(nameInput, { target: { value: "Alice" } });

    const findBtn = screen.getByRole("button", { name: /Find a Game/i });
    fireEvent.click(findBtn);

    await waitFor(() => {
      expect(api.quickMatch).toHaveBeenCalledWith("Alice", null);
      expect(mockNavigate).toHaveBeenCalledWith("/m/GAME1");
    });
  });

  it("triggers joinMatch on code form submit", async () => {
    api.joinMatch.mockResolvedValueOnce({ code: "ABCDE", playerId: "p2", token: "tok2" });

    render(<Home />);
    const nameInput = screen.getByPlaceholderText("what should they call you");
    fireEvent.change(nameInput, { target: { value: "Bob" } });

    const codeInput = screen.getByPlaceholderText("CODE");
    fireEvent.change(codeInput, { target: { value: "abcde" } });

    const joinBtn = screen.getByRole("button", { name: /^Join$/i });
    fireEvent.click(joinBtn);

    await waitFor(() => {
      expect(api.joinMatch).toHaveBeenCalledWith("ABCDE", "Bob", null);
      expect(mockNavigate).toHaveBeenCalledWith("/m/ABCDE");
    });
  });

  it("triggers createMatch when submitting in Host Lobby mode", async () => {
    api.createMatch.mockResolvedValueOnce({ code: "HOST1", playerId: "p3", token: "tok3" });

    render(<Home />);
    const nameInput = screen.getByPlaceholderText("what should they call you");
    fireEvent.change(nameInput, { target: { value: "Charlie" } });

    const hostTab = screen.getByRole("tab", { name: /Host Lobby/i });
    fireEvent.click(hostTab);

    const createBtn = screen.getByRole("button", { name: /Create Lobby/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(api.createMatch).toHaveBeenCalledWith("Charlie", expect.any(Object), null);
      expect(mockNavigate).toHaveBeenCalledWith("/m/HOST1");
    });
  });
});
