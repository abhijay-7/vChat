require("dotenv").config();
const socketIO = require("socket.io");
const express = require("express");
const http = require("http");
const { instrument } = require("@socket.io/admin-ui");

const app = express();

const server = http.createServer(app);

const rooms = new Map();

const io = new socketIO.Server(server, {
    cors: {
        origin: "*",
        //  ["https://admin.socket.io","http://localhost:5173","http://10.0.7.234:5173/" ],

        credentials: true,
    },
});

const defNsp = io.of("/");

defNsp.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (token && token == "verified") {
        console.log("auth verified for socket");
        next();
    } else {
        console.log("unverified");
        next(new Error("unauthorized"));
    }
});

// io.on("connection", async(socket) => {

//     // console.log("new connection:" , socket);

//     // const all = await io.fetchSockets();
//     // console.log(all)
//     io.emit("hello", `hello  bros,${"a"} `);
//     socket.on("message", (data) => {
//         socket.emit("message", `${socket.id} : ${data} `);
//         console.log(socket);
//     });
//     socket.on("broadcast-request", (data) => {
//         io.emit("message", `(broadcast) ${socket.id}: ${data} `);
//         console.log(socket);
//     });
//     socket.on("join-room", async(roomId)=>{
//         console.log(

//             io.of("/").adapter.rooms.get(roomId)
//         )
//         if(roomId){

//             socket.join(roomId)
//             console.log(`${socket.id} joined room ${roomId}`);
//         }
//     })
//     socket.on("leave-room", (roomId)=>{
//         if(roomId){
//             socket.leave(roomId);
//             console.log(`${socket.id} left room: ${roomId}`);

//         }

//     })
//     socket.on("send-message-room", ({message,roomId})=>{
//         console.log(message,roomId);
//         io.to(roomId).emit( "message-room", {
//             sender:socket.id,
//             message
//         })
//     })

//     socket.on("initate-call", ({ room_id})=>{
//         rooms[room_id] = [];
//         const peers =  rooms[room_id];
//         peers.push(socket.id);
//         socket.to(room_id).emit("incoming-call",{from: socket.id});
//     })

//     socket.on("answer-call", ({offer, room_id})=>{
//         const peers = rooms[room_id] || [];
//         socket.emit("existing-peers", peers);

//         peers.forEach(peer => {
//             io.to(peer).emit("new-peer", socket.id);
//         });

//         peers.push(socket.id);
//     });

//     socket.on("send-offer", ({offer, to_socket_id})=>{
//         socket.to(to_socket_id).emit("offer",{from: socket.id, offer: offer});
//     })
//     socket.on("send-answer", ({answer,to_socket_id})=>{
//         socket.to(to_socket_id).emit("answer",{from: socket.id , answer: answer});
//     })
//     socket.on("candidate",({ice_candidate,to_socket_id})=> {
//         socket.to(to_room_id).emit("ice-candidate-update",{from: socket.id, ice_candidate: ice_candidate});
//     })

// });

io.on("connection", (socket) => {
    console.log("New socket connected:", socket.id);

    // ---------- JOIN ROOM ----------
    socket.on("join-room", (roomId) => {
        if (!roomId) return;
        socket.join(roomId);
        console.log(`${socket.id} joined room ${roomId}`);
    });

    // --- messaging features-----
    socket.on("message", (data) => {
        socket.emit("message", `${socket.id} : ${data} `);
        console.log(socket);
    });
    socket.on("send-message-room", ({ message, roomId }) => {
        console.log(message, roomId);
        io.to(roomId).emit("message-room", {
            sender: socket.id,
            message,
        });
    });
    socket.on("broadcast-request", (data) => {
        io.emit("message", `(broadcast) ${socket.id}: ${data} `);
        console.log(socket);
    });
    socket.on("leave-room", (roomId) => {
        if (roomId) {
            socket.leave(roomId);
            console.log(`${socket.id} left room: ${roomId}`);
        }
    });

    // ---------- INITIATE CALL ----------
    socket.on("initiate-call", ({ roomId }) => {
        if (!roomId) return;

        if (!rooms[roomId]) {
            rooms[roomId] = [];
        }
        const peers = rooms[roomId];

        peers.push(socket.id);

        socket.to(roomId).emit("incoming-call", { from: socket.id });

        console.log(`call initaited in room ${roomId} by ${socket.id}`);
    });

    // ---------- ANSWER CALL ----------
    socket.on("answer-call", ({ roomId }) => {
        if (!roomId) return;

        if (!rooms[roomId]) return;

        const peers = rooms[roomId];

        socket.emit("existing-peers", peers);

        peers.forEach((peer) => {
            io.to(peer).emit("new-peer", socket.id);
        });

        if (!peers.includes(socket.id)) {
            peers.push(socket.id);
        }

        console.log(`call answered in room ${roomId} by ${socket.id}`);
    });

    socket.on("end-call", ({ roomId }) => {
        if (!roomId) return;
        if (!rooms[roomId]) return;
        io.to(roomId).emit("call-ended-by-peer", { from: socket.id });
        rooms[roomId] = rooms[roomId].filter((id) => id != socket.id);
        console.log(`terminated call from ${socket.id} in room ${roomId}`);
    });

    // ---------- SDP OFFERS / ANSWERS ----------
    socket.on("send-offer", ({ offer, to }) => {
        io.to(to).emit("offer", { from: socket.id, offer });
    });

    socket.on("send-answer", ({ answer, to }) => {
        io.to(to).emit("answer", { from: socket.id, answer });
    });

    // ---------- ICE CANDIDATES ----------
    socket.on("candidate", ({ candidate, to }) => {
        io.to(to).emit("ice-candidate-update", {
            from: socket.id,
            candidate: candidate,
        });
    });

    // Cleanup on disconnect
    socket.on("disconnect", () => {
        for (const [roomId, peers] of Object.entries(rooms)) {
            rooms[roomId] = peers.filter((p) => p !== socket.id);
            if (rooms[roomId].length === 0) {
                delete rooms[roomId];
            }
        }
        console.log(`${socket.id} disconnected and removed from rooms`);
    });
});

app.get("/chat", (req, res) => {
    res.send("This is the HTTP chat route");
});

const chatNsp = io.of("/chat");
chatNsp.on("connection", (socket) => {
    console.log("Socket connected to /chat:", socket.id);
});
instrument(io, { auth: false, namespaceName: "/admin", mode: "development" });

server.listen(3000, () =>
    console.log("server started listening on http://localhost:3000")
);
