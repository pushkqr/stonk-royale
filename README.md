# Stonk Royale

Stonk Royale is a real-time multiplayer cryptocurrency paper-trading simulator. Players compete in timed lobbies to generate the highest Profit and Loss (PnL) using live market data.

## Project Structure

This repository is divided into two primary modules:

- **[`/frontend`](./frontend/)**: A React 18 (Vite) client application featuring a trading dashboard, TradingView charts, and real-time multiplayer synchronization.
- **[`/backend`](./backend/)**: A Spring Boot 3.x server. It manages game logic, STOMP WebSocket broadcasts, transaction validation, and live data ingestion from the Binance API.
- **[`/node-backend`](./node-backend/)**: A deprecated Node.js backend alternative. The Spring Boot backend is the supported server.

For detailed documentation on each stack, refer to their respective documentation files: [Frontend Docs](./frontend/HELP.md) | [Backend Docs](./backend/HELP.md).

## Features

- **Real-Time Market Data**: Streams live WebSocket trades from Binance.
- **Multiplayer Lobbies**: Supports custom rooms with configurable starting balances, maximum players, and game durations.
- **Live Trading Engine**: Executes market orders with backend validation.
- **Global Chat and Feed**: Broadcasts player messages and trade events via STOMP WebSockets.
- **Dynamic Leaderboards**: Updates player rankings in real-time based on portfolio valuations.
- **Automated Liquidations**: Liquidates holdings and calculates final scores when the room timer expires.

## Quick Start

### Prerequisites

- Node.js (v18+)
- Java 26
- MySQL (or equivalent SQL database)
- Firebase Account (for JWT authentication)

### 1. Start the Backend

Navigate to the backend directory, configure `application.properties` and your Firebase `serviceAccount.json`, then run the server:

```bash
cd backend
./mvnw spring-boot:run
```

The backend defaults to port 8080.

### 2. Start the Frontend

Navigate to the frontend directory, configure your `.env` with Firebase API keys, install dependencies, and start the development server:

```bash
cd frontend
npm install
npm run dev
```

The frontend defaults to port 3000.

## Authentication

Authentication is handled via the Firebase Admin SDK.
- The frontend manages sign-ins and passes a Bearer ID Token to the backend.
- The Spring Boot backend verifies the token signatures for REST requests and WebSocket connections to ensure security.

## License

This project is available under standard MIT licensing terms.
