# Stonk Royale - Backend Documentation

This directory contains the Spring Boot backend powering **Stonk Royale**, a real-time multiplayer crypto paper-trading game. It was built to handle high-concurrency websocket communication, robust transactional integrity, and live market data ingestion.

## Tech Stack
- **Framework:** Spring Boot 3.x
- **Language:** Java 26
- **Database:** MySQL (Production) / H2 (Testing)
- **Security:** Spring Security + Firebase Admin SDK (JWT Authentication)
- **Real-Time Data:** Spring WebSockets & STOMP Protocol
- **Market Data:** Binance Live WebSockets API

---

## Core Architecture & Features

### 1. Multiplayer Lobbies (`RoomService`)
- Manages room creation, player joining, and ready-state toggling.
- Uses **Pessimistic Locking** (`@Lock(LockModeType.PESSIMISTIC_WRITE)`) to ensure race conditions don't occur when multiple players attempt to join or ready-up simultaneously.

### 2. Live Trading Engine (`TradeService`)
- Players execute BUY/SELL orders based on live crypto prices.
- All trades are wrapped in `@Transactional` bounds with Pessimistic Locking to ensure absolute data integrity (e.g., preventing a player from spending more cash than they have).
- Validated via `jakarta.validation` annotations (e.g., `@DecimalMin`) to catch bad data at the Controller layer.

### 3. Real-Time Market Feed (`BinanceService` & `GameStateService`)
- On application boot, the server opens a raw WebSocket connection to Binance (`wss://stream.binance.com:9443/ws/btcusdt@trade`) to ingest live trade data.
- The `GameStateService` acts as the single source of truth, caching these prices so the trading engine can instantly execute orders without waiting for external API calls.

### 4. Automated Endgame Liquidations (`EndgameService`)
- Runs a `@Scheduled` cron job every 10 seconds to detect rooms that have surpassed their time limit.
- Automatically liquidates all player crypto holdings at the exact closing market price, calculates the final PNL, and broadcasts the winner to the lobby.

---

## Configuration & Setup

To run this backend locally, you must provide your own configuration files.

### 1. `application.properties`
Create `src/main/resources/application.properties` with your database and environment settings:
```properties
server.servlet.context-path=/api

spring.datasource.url=jdbc:mysql://localhost:3306/stonk_royale
spring.datasource.username=root
spring.datasource.password=${DB_PASSWORD:yourpassword}
spring.jpa.hibernate.ddl-auto=update

spring.output.ansi.enabled=ALWAYS
```

### 2. Firebase Service Account
Create `src/main/resources/serviceAccount.json` and paste in your Firebase Service Account JSON key. This is required for `FirebaseConfig.java` to initialize the Admin SDK and verify JWT tokens sent by the frontend.

---

## API Reference & Endpoints

> [!IMPORTANT]
> **Authentication Required:** All HTTP endpoints are prefixed with the context path `/api` and require a valid Firebase ID token in the header:
> `Authorization: Bearer <token>`

### REST Endpoints
| Method | Endpoint | Description | Payload |
|--------|----------|-------------|---------|
| `POST` | `/api/users/auth` | Authenticates or registers a user. | `User` object |
| `POST` | `/api/room/create` | Creates a new game lobby. | `Room` settings |
| `POST` | `/api/room/join/{roomCode}`| Joins an existing lobby. | None |
| `GET`  | `/api/room/{roomCode}` | Retrieves current room state & players.| None |
| `POST` | `/api/trade/` | Executes a BUY/SELL order. | `TradeRequest` |
| `GET`  | `/api/trade/history/{roomCode}`| Retrieves user's trade history. | None |

### WebSocket Endpoints (STOMP)
- **Connection URL:** `ws://localhost:8080/api/ws`
- **Application Destination Prefix:** `/app`
- **Broker Topic Prefix:** `/topic`

#### Client-to-Server (Send to `/app`)
- `/ping` - Keepalive ping.
- `/chat/{roomCode}` - Broadcasts a chat message. Payload: `ChatMessage`.
- `/ready/{roomCode}` - Toggles player's ready state.

#### Server-to-Client (Subscribe to `/topic`)
- `/topic/room/{roomCode}/chat` - Receives global chat messages.
- `/topic/room/{roomCode}/readyStatus` - Receives updates when a player readies up.
- `/topic/room/{roomCode}/start` - Receives the game start event.
- `/topic/room/{roomCode}/trades` - Receives live transaction feed of players' trades.
- `/topic/room/{roomCode}/gameOver` - Receives the final leaderboard and liquidation summary upon time expiration.

---

## Data Payloads (JSON)

When interacting with the endpoints above, use the following JSON payload structures:

### `User` (for `/api/users/auth`)
```json
{
  "oauthId": "string (required, unique Firebase UID)",
  "username": "string (required, player's display name)",
  "avatarUrl": "string (optional, URL to avatar image)"
}
```

### `Room` (for `/api/room/create`)
```json
{
  "startingBalance": "number (e.g., 100000.0)",
  "durationMinutes": "number (integer, e.g., 10)",
  "maxPlayers": "number (integer, e.g., 5)"
}
```

### `TradeRequest` (for `/api/trade/`)
```json
{
  "roomCode": "string (required)",
  "ticker": "string (required, e.g., 'BTC')",
  "quantity": "number (required, must be >= 0.0001)",
  "type": "string (required, 'BUY' or 'SELL')"
}
```

### `ChatMessage` (for `/app/chat/{roomCode}`)
```json
{
  "username": "string (required)",
  "text": "string (required, the message content)"
}
```

---

## Testing

The backend is fortified by a comprehensive suite of Mockito unit tests, bypassing the need for a live database or a live Binance connection during testing. 

To run the test suite:
```bash
# Windows
.\mvnw.cmd clean test

# Mac / Linux
./mvnw clean test
```

The tests utilize an in-memory **H2 Database** configured via `src/test/resources/application-test.properties`.
