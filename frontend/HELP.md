# Stonk Royale - Frontend Documentation

This directory contains the React frontend for **Stonk Royale**, a real-time multiplayer crypto paper-trading game. It provides a sleek, modern UI for live trading, real-time leaderboards, and interactive charts.

## Tech Stack

- **Framework:** React 18 (Vite)
- **Language:** JavaScript (JSX)
- **Routing:** React Router v6
- **Styling:** Vanilla CSS (`index.css`) with modern UI patterns (glassmorphism, neon accents)
- **Real-Time Data:** `@stomp/stompjs` (WebSockets)
- **Authentication:** Firebase Auth
- **Charting:** `lightweight-charts` (TradingView)
- **Icons:** `lucide-react`

---

## Core Architecture & Features

### 1. Context Providers (`AuthContext` & `SocketContext`)

- **`AuthContext`**: Manages Firebase Authentication state. Handles user sign-in and communicates with the backend to sync the user profile.
- **`SocketContext`**: Maintains a stable STOMP WebSocket connection to the Spring Boot backend. It injects the Firebase JWT token into the connection headers and includes a reconnect mechanism that seamlessly unmounts and remounts React subscriptions to prevent background tabs from going "deaf".

### 2. Live Trading Dashboard (`Game.jsx`)

- **Dual Pane Trading Desk**: Separate sections for executing precise BUY and SELL market orders.
- **Chart Widget**: Integrates TradingView's `lightweight-charts` to plot real-time incoming STOMP price data against historical data fetched via REST.
- **Global Feed**: A real-time chat pane that broadcasts both player chat messages and trade execution events across the lobby.
- **Live Leaderboard**: Subscribes to the backend leaderboard stream to dynamically re-rank players based on live portfolio valuations.

### 3. Lobby & Room Management (`Home.jsx` & `Lobby.jsx`)

- Players can create customized game rooms (duration, starting balance, max players) or join via a 5-letter alphanumeric room code.
- Lobby features a real-time "Ready Up" mechanism. The game only starts once all players have successfully locked in.

### 4. Endgame & Results (`Results.jsx`)

- Listens for the backend's automated liquidation and `gameOver` STOMP event.
- Safely parses the final nested user structures and renders the tournament winner and final PNL rankings.

---

## Configuration & Setup

### Firebase Configuration

To run the frontend locally, you must provide your own Firebase project configuration credentials.

Create a `.env` file in the root of the `frontend` directory with the following variables:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

These variables are consumed by `src/config/firebase.js` to initialize the Firebase SDK.

---

## Running Locally

Make sure you have Node.js installed.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the Vite development server:

   ```bash
   npm run dev
   ```

3. The application will be accessible at `http://localhost:3000` (or whichever port Vite automatically assigns).
