const express = require("express");
const path = require("path");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());

// Serve the "frontend" folder as static files
app.use("/frontend", express.static(path.join(__dirname, "frontend")));

app.get("/frontend/style.css", (req, res) => {
    res.type("text/css");
    res.sendFile(path.join(__dirname, "frontend/style.css"));
});

// Serve the root "index.html" file
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// Serve the "models" folder
app.use("/models", express.static(path.join(__dirname, "frontend/models")));

const server = http.createServer(app);
server.listen(5000, () => console.log("Server running on port 5000"));

const io = new Server(server, {
    cors: {
        origin: "*", // Replace with your frontend URL in production
        methods: ["GET", "POST"]
    }
});

const rooms = {}; // Store users in rooms

io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("create-room", (roomId) => {
        if (!roomId) {
            socket.emit("error", "Room ID is required");
            return;
        }

        if (!rooms[roomId]) {
            rooms[roomId] = [];
            console.log(`Room ${roomId} created`);
            socket.emit("room-created", roomId);
        } else {
            console.log(`Room ${roomId} already exists`);
            socket.emit("room-exists", roomId);
        }
    });

    socket.on("join-room", (roomId, userId, userName) => {
        if (!roomId || !userId || !userName) {
            socket.emit("error", "Room ID, User ID, and User Name are required");
            return;
        }

        if (!rooms[roomId]) {
            console.log(`Room ${roomId} not found`);
            socket.emit("room-not-found");
            return;
        }

        rooms[roomId].push({ userId, userName });
        console.log(`${userName} (${userId}) joined room ${roomId}`);

        socket.join(roomId);
        socket.emit("room-joined", roomId);
        socket.broadcast.to(roomId).emit("user-connected", { userId, userName });

        socket.on("signal", (data) => {
            if (!data.to || !data.from || !data.signal) {
                socket.emit("error", "Invalid signal data");
                return;
            }
            io.to(data.to).emit("signal", { from: data.from, signal: data.signal });
        });

        socket.on("disconnect", () => {
            rooms[roomId] = rooms[roomId].filter((user) => user.userId !== userId);
            console.log(`${userName} (${userId}) disconnected from room ${roomId}`);
            socket.broadcast.to(roomId).emit("user-disconnected", userId);
        });
    });
});