const express = require('express');
const router = express.Router();
const { execute } = require('../connection-wrapper');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');

// 1. GET 3 latest events
router.get('/', async (req, res) => {
    try {

        const rows = await execute(`
            SELECT e.id, e.description, e.created_at, e.greg_date, e.hebrew_date,
                   et.name AS type,et.icon, et.color, JSON_OBJECT(
            'id', ui.id,
            'name', CONCAT(ui.first_name, ' ', ui.last_name),
            'email', u.email
        ) AS user 
            FROM events e
            JOIN event_types et ON e.type_id = et.id
            JOIN user_info ui ON e.user_id = ui.id
            JOIN user u ON e.user_id = u.id
            ORDER BY e.created_at DESC
            LIMIT 3
          `);

        res.status(200).json(rows);
    } catch (error) {
        // Handle errors
        console.error('Error fetching events:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

// 2. GET events types
router.get('/types', async (req, res) => {
    try {

        const result = await execute(`SELECT * FROM event_types`);

        res.status(200).json(result);
    } catch (error) {
        // Handle errors
        console.error('Error fetching events types:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});


// 2. Post new event
router.post('/',
    [
        // Input validation using express-validator
        body('description').notEmpty().withMessage('Description is required'),
    ],
    async (req, res) => {
        console.log({ req })
        // 1. Input Validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const sursuperiorId = req.user.userId;

        // 2. Extract data from the request body
        const { greg_date, hebrew_date, userId = sursuperiorId, description } = req.body;

        // 3. Database Interaction
        try {
            // Insert the new event into the database
            const eventId = uuidv4();  // Generate a unique ID for the event.

            const result = await execute(
                'INSERT INTO events (id, user_id, description, greg_date, hebrew_date) VALUES (?, ?, ?, ?, ?)',
                [eventId, userId, description, greg_date, hebrew_date]
            );

            if (result.affectedRows === 1) {
                // 4. Send a success response
                res.status(201).json({ message: 'event created successfully', eventId }); // Include the new campaign's ID in the response
            } else {
                // Handle the case where the insertion failed (though this is unlikely)
                res.status(500).json({ message: 'Failed to create event in the database' });
            }
        } catch (error) {
            // 5. Handle errors
            console.error('Error creating event:', error);
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }
);

// 3. Delete event by ID (only owner or superior)
router.delete('/:id', async (req, res) => {
    const userId = req.user.id;
    const isAdmin = req.user.role_id == 100 || req.user.role_id == 101;

    try {
        const rows = await execute(`SELECT id FROM events WHERE id = ?`, [req.params.id]);

        if (!rows.length) {
            return res.status(400).json({ message: 'Event not found' });
        }

        const isOwner = rows[0].user_id === userId;

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        await execute(`DELETE FROM events WHERE id = ?`, [req.params.id]);
        res.json({ message: 'Event deleted', eventId: req.params.id });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting event', error: err.message });
    }
});

module.exports = router;