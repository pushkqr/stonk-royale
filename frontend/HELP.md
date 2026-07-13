# Stonk Royale - Frontend Documentation

This directory contains the React frontend for Stonk Royale, a real-time multiplayer cryptocurrency paper-trading game.

## Tech Stack

- **Framework:** React 18 (Vite)
- **Routing:** React Router v6
- **Styling:** Vanilla CSS (`index.css`)
- **Real-Time Data:** `@stomp/stompjs` (WebSockets)
- **Authentication:** Firebase Auth
- **Charting:** `lightweight-charts` (TradingView)

## Core Architecture

### 1. Context Providers (`AuthContext` & `SocketContext`)
- **`AuthContext`**: Manages Firebase Authentication state and syncs user profiles with the backend.
- **`SocketContext`**: Maintains a STOMP WebSocket connection to the Spring Boot backend. It injects the Firebase JWT token into connection headers and handles reconnection logic to prevent background tabs from disconnecting.

### 2. Live Trading Dashboard (`Game.jsx`)
- **Trading Desk**: Interface for executing market orders.
- **Chart Widget**: Uses `lightweight-charts` to display real-time price data via STOMP and historical data via REST.
- **Global Feed**: Displays chat messages and trade execution events.
- **Live Leaderboard**: Displays real-time player rankings based on portfolio valuations.

### 3. Lobby Management (`Home.jsx` & `Lobby.jsx`)
- Supports room creation and joining via a 5-character alphanumeric room code.
- Includes a "Ready Up" mechanism to synchronize game starts.

### 4. Results (`Results.jsx`)
- Renders the final tournament winner and PnL rankings based on the endgame STOMP event.

## Setup and Configuration

### Firebase Configuration

Create a `.env` file in the root of the `frontend` directory with your Firebase project credentials:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### Running Locally

Ensure Node.js is installed on your system.

1. Install project dependencies:
   ```bash
   npm install
   ```

2. Start the Vite development server:
   ```bash
   npm run dev
   ```

3. Open the application in your browser at `http://localhost:3000`.
