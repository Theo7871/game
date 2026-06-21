import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Adjust this in production for security
        methods: ["GET", "POST"]
    }
});

// Serve static files from Vite build folder (dist)
app.use(express.static(path.join(__dirname, 'dist')));

// Ensure fallback for SPA routing (Express 5 compatible wildcard)
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const players = {};

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Create a new player entry
    players[socket.id] = {
        id: socket.id,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0 }
    };

    // Send the current players to the new player
    socket.emit('currentPlayers', players);

    // Broadcast the new player to everyone else
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // Handle player movement
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].position = movementData.position;
            players[socket.id].rotation = movementData.rotation;
            // Broadcast movement to all other players
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        delete players[socket.id];
        // Tell everyone that this player left
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Multiplayer server running on port ${PORT}`);
});
