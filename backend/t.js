


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

        if (!peers.includes(socket.id)) {
            peers.push(socket.id);
        }

        socket.to(roomId).emit("incoming-call", { from: socket.id });
        console.log(`${socket.id} initiated call in room ${roomId}`);
    });

    // ---------- ANSWER CALL ----------
    socket.on("answer-call", ({ roomId }) => {
        if (!roomId) return;

        if (!rooms[roomId]) {
            rooms[roomId] = [];
        }
        const peers = rooms[roomId];

        console.log("answer recieved");

        socket.emit("existing-peers", peers);

        peers.forEach((peerId) => {
            io.to(peerId).emit("new-peer", { id: socket.id });
        });

        if (!peers.includes(socket.id)) {
            peers.push(socket.id);
        }

        console.log(`${socket.id} answered call in room ${roomId}`);
    });

    // ---------- SDP OFFERS / ANSWERS ----------
    socket.on("send-offer", ({ offer, to }) => {
        socket.to(to).emit("offer", { from: socket.id, offer });
    });

    socket.on("send-answer", ({ answer, to }) => {
        socket.to(to).emit("answer", { from: socket.id, answer });
    });

    // ---------- ICE CANDIDATES ----------
    socket.on("candidate", ({ candidate, to }) => {
        socket
            .to(to)
            .emit("ice-candidate-update", { from: socket.id, candidate });
    });

    // Cleanup on disconnect
    socket.on("disconnect", () => {
        for (const [roomId, peers] of Object.entries(rooms)) {
            rooms[roomId] = peers.filter((p) => p !== socket.id);
        }
        console.log(`${socket.id} disconnected and removed from rooms`);
    });
});