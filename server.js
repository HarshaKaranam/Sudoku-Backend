const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();


// Define variables for IP and Port
const PORT = process.env.PORT || 3000; // Default to 3000 if not specified in .env
const HOST = process.env.HOST || '0.0.0.0'; // Default to 0.0.0.0 for external access




const app = express();
//const port = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// PostgreSQL Pool
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Get a puzzle by difficulty
app.get('/puzzle/:difficulty', async (req, res) => {
    try {
        const { difficulty } = req.params;
        const result = await pool.query(
            'SELECT * FROM puzzles WHERE difficulty = $1 ORDER BY RANDOM() LIMIT 1', // Updated column name
            [difficulty]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Puzzle not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get a puzzle by ID
app.get('/puzzle/id/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'SELECT * FROM puzzles WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            // Return a consistent response when no puzzle is found
            return res.status(404).json({ id: '0000', message: 'Game not found' });
        }

        res.json(result.rows[0]); // Return the puzzle with the given ID
    } catch (error) {
        console.error('Error fetching puzzle by ID:', error);
        res.status(500).json({ id: '0000', message: 'Internal Server Error' });
    }
});


// Get leaderboard for a puzzle
app.get('/leaderboard/:id', async (req, res) => {
    try {
        const { puzzleId } = req.params;
        const result = await pool.query(
            'SELECT player_name, completion_time FROM leaderboard WHERE id = $1 ORDER BY completion_time ASC LIMIT 10',
            [id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Add a player to the leaderboard
app.post('/leaderboard', async (req, res) => {
    try {
        const { puzzleId, playerName, completionTime } = req.body;
        const result = await pool.query(
            'INSERT INTO leaderboard (id, player_name, completion_time) VALUES ($1, $2, $3) RETURNING *',
            [id, playerName, completionTime]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// Generate Room Code and Add to Scoreboard
app.post('/generate-room', async (req, res) => {
    const { roomCode, gameCode, userName } = req.body; // Extract roomCode and gameCode from the request body

    try {
        // Insert roomCode and gameCode into the database, with a timestamp
        const result = await pool.query(
            `INSERT INTO scoreboard (room_code, game_code, player_name, time_stamp)
             VALUES ($1, $2, $3, NOW()) RETURNING *`,
            [roomCode, gameCode, userName]
        );

        // Send back the newly created room details as JSON
        res.status(200).json({
            success: true,
            message: 'Room created successfully',
            room: result.rows[0],
        });
    } catch (error) {
        console.error('Error creating room:', error.message);

        // Send a descriptive error message to the client
        res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            details: error.message,
        });
    }
});

// Search for Room
app.get('/search-room/:roomCode', async (req, res) => {
    const { roomCode } = req.params;
    try {
        const result = await pool.query(
            `SELECT 1 FROM scoreboard WHERE room_code = $1 LIMIT 1`,
            [roomCode]
        );

        // Return whether the room exists
        res.json({ exists: result.rows.length > 0 });
    } catch (error) {
        console.error('Error checking room code:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Fetch game_code by room_code
app.get('/game-code/:roomCode', async (req, res) => {
    const { roomCode } = req.params;

    try {
        // Query the database for game_code based on room_code
        const result = await pool.query(
            `SELECT game_code FROM scoreboard WHERE room_code = $1 LIMIT 1`,
            [roomCode]
        );

        // Check if a game_code is found
        if (result.rows.length > 0) {
            res.json({ gameCode: result.rows[0].game_code }); // Return the game_code
        } else {
            res.status(404).json({ error: 'Room code not found' }); // Handle not found
        }
    } catch (error) {
        console.error('Error fetching game code:', error);
        res.status(500).json({ error: 'Internal Server Error' }); // Handle server errors
    }
});



// Start Game and Update Player Name
app.put('/start-game', async (req, res) => {
    const { roomCode, playerName } = req.body;
    try {
        const result = await pool.query(
            `UPDATE scoreboard
             SET player_name = $1
             WHERE room_code = $2
             RETURNING *`,
            [playerName, roomCode]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

//Update percentage Completed
app.put('/update-progress', async (req, res) => {
    const { roomCode, completed, playerName } = req.body; // completed = %completed
    try {
        const result = await pool.query(
            `UPDATE scoreboard
             SET percentage_completed = $1
             WHERE room_code = $2 and player_name = $3
             RETURNING *`,
            [completed, roomCode, playerName]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// fetch scoreBoard
app.get('/scoreboard/:roomCode', async (req, res) => {
    const { roomCode } = req.params;
    try {
        const result = await pool.query(
            `SELECT * FROM scoreboard WHERE room_code = $1 ORDER BY time_taken ASC`,
            [roomCode]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// Start the server
app.listen(PORT, HOST, () => {
    console.log(`Sudoku backend server running on http://${HOST}:${PORT}`);
});