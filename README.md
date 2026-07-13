# Stonk Royale 📈🏆

**Stonk Royale** is a high-octane, real-time multiplayer crypto paper-trading simulator. Players compete in timed lobbies to see who can generate the highest Profit and Loss (PnL) using live cryptocurrency market data.

Test your trading strategies against friends in a zero-risk environment, featuring live market charts, instant order execution, and a global chat feed. When the timer runs out, all assets are liquidated at the closing market price, and the player with the highest net worth is crowned the winner!

---

## 🏗️ Project Structure

This repository is split into independent frontend and backend modules:

- **[`/frontend`](./frontend/)**: The React 18 (Vite) client. It features a modern, responsive trading dashboard with TradingView-powered live charts and real-time multiplayer synchronization.
- **[`/backend`](./backend/)**: The Spring Boot 3.x server. It powers the game logic, manages secure STOMP WebSocket broadcasts, enforces strict transactional bounds on trades, and streams live data from the Binance API.

_For in-depth technical documentation on either stack, please refer to their respective `HELP.md` files: [Frontend Docs](./frontend/HELP.md) | [Backend Docs](./backend/HELP.md)._

---

## 🚀 Features

- **Real-Time Market Data**: Ingests live WebSocket trades from Binance for true-to-life price action.
- **Multiplayer Lobbies**: Create custom rooms with configurable starting balances, maximum players, and game durations.
- **Live Trading Engine**: Execute BUY and SELL market orders instantly. Transactions are strictly validated on the backend to prevent race conditions.
- **Global Chat & Feed**: A live STOMP-powered feed that broadcasts both player chats and trade events.
- **Dynamic Leaderboards**: Watch the rankings shift in real-time as crypto prices fluctuate during the match.
- **Automated Liquidations**: At the end of the match, an automated cron job liquidates all holdings and declares a winner.

---

## 🛠️ Quick Start Guide

### Prerequisites

- **Node.js** (v18+) for the frontend.
- **Java 26** for the Spring Boot backend.
- **MySQL** (or an equivalent SQL database) for the backend production environment.
- **Firebase Account**: Required for authentication (JWT tokens).

### 1. Start the Backend (Spring Boot)

Navigate to the backend directory, ensure your `application.properties` and Firebase `serviceAccount.json` are configured, and run the server:

```bash
cd backend
./mvnw spring-boot:run
```

_(The backend defaults to running on port 8080)_

### 2. Start the Frontend (React + Vite)

In a new terminal window, navigate to the frontend directory, configure your `.env` with Firebase API keys, install dependencies, and spin up the development server:

```bash
cd frontend
npm install
npm run dev
```

_(The frontend will start on port 3000 or the next available port)_

---

## 🔐 Authentication & Security

Stonk Royale relies on the **Firebase Admin SDK** for secure, stateless authentication.

- The frontend handles user sign-ups and sign-ins via Google or Email.
- The React app passes a Bearer ID Token to the Spring Boot backend on every REST request and STOMP connection.
- The backend verifies the token signatures independently to ensure bad actors cannot spoof trades or chat messages.

---

## 📄 License

This project is open-source and available under standard MIT licensing terms. Enjoy paper trading!
