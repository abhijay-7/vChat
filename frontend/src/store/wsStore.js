import { create } from "zustand";
import { io } from "socket.io-client";

const url = "https://1446760368be.ngrok-free.app/";

const useWsStore = create((set, get, api) => ({
    socket: io(url, {
        autoConnect: false,
        auth: {
            token: "verified",
        },
           extraHeaders: {
            "ngrok-skip-browser-warning": "true"
        },
        transportOptions: {
            polling: {
                extraHeaders: {
                    "ngrok-skip-browser-warning": "true"
                }
            }
        }
    }),
    pcs: new Map(),
    stream : null,

}));

export default useWsStore;
