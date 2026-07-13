import { createContext, useContext, useEffect, useState } from "react";
import { Client } from "@stomp/stompjs";
import { useAuth } from "./AuthContext";

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [stompClient, setStompClient] = useState(null);
  const { firebaseUser } = useAuth();

  useEffect(() => {
    if (!firebaseUser) return;

    let client = null;

    const connectToStomp = async () => {
      try {
        const token = await firebaseUser.getIdToken();

        client = new Client({
          brokerURL: "ws://localhost:8080/api/ws",
          connectHeaders: {
            Authorization: `Bearer ${token}`,
          },
          debug: function (str) {
            console.log("STOMP: " + str);
          },
          reconnectDelay: 5000,
          heartbeatIncoming: 4000,
          heartbeatOutgoing: 4000,
        });

        client.onConnect = function (frame) {
          console.log("STOMP Connected");
          // Briefly set to null to force React to unmount/remount subscriptions if reconnecting
          setStompClient(null);
          setTimeout(() => setStompClient(client), 10);
        };

        client.onStompError = function (frame) {
          console.error("Broker reported error: " + frame.headers["message"]);
          console.error("Additional details: " + frame.body);
        };

        client.activate();
      } catch (err) {
        console.error("Failed to connect to STOMP:", err);
      }
    };

    connectToStomp();

    return () => {
      if (client) {
        client.deactivate();
      }
    };
  }, [firebaseUser]);

  return (
    <SocketContext.Provider value={stompClient}>
      {children}
    </SocketContext.Provider>
  );
};
