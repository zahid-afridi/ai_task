import { io } from "socket.io-client";

const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

export const socket = io(backendUrl, {
  autoConnect: true,
  transports: ["websocket", "polling"],
});
