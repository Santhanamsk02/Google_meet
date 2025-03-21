const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const { Server } = require("socket.io");

const app = express();

app.use(cors()); 

app.use(express.static(path.join(__dirname, "frontend")));

app.use("/models", express.static(__dirname + "/../frontend/models"));
const server = http.createServer(app);

server.listen(5000, () => console.log("Server running on port 5000"));

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const rooms = {}; // Store users in rooms

io.on("connection", (socket) => {
    socket.on("create-room", (roomId) => {
        if (!rooms[roomId]) {
            rooms[roomId] = [];
            socket.emit("room-created", roomId);
        } else {
            socket.emit("room-exists", roomId);
        }
    });

    socket.on("join-room", (roomId, userId, userName) => {
        if (!rooms[roomId]) {
            socket.emit("room-not-found");
            return;
        }

        rooms[roomId].push({ userId, userName });

        socket.join(roomId);
        socket.emit("room-joined", roomId);
        socket.broadcast.to(roomId).emit("user-connected", { userId, userName });

        socket.on("signal", (data) => {
            io.to(data.to).emit("signal", { from: data.from, signal: data.signal });
        });

        socket.on("disconnect", () => {
            rooms[roomId] = rooms[roomId].filter((user) => user.userId !== userId);
            socket.broadcast.to(roomId).emit("user-disconnected", userId);
        });
    });
});
