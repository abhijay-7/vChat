import { create } from "zustand";
import { io } from "socket.io-client";

const url = "http://localhost:3000";

const useWsStore = create((set, get, api) => ({
    socket: io(url, {
        autoConnect: false,
        auth: {
            token: "verified",
        },
    }),
    pcs: new Map(),
    stream : null,

}));

export default useWsStore;
