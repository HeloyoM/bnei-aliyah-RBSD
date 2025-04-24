const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth');
const { execute } = require('../connection-wrapper');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');

router.get('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId; // Get the user ID from the JWT.

        // Query the database to get campaigns and their types
        const campaigns = await execute(
            `SELECT c.id, c.name, c.dueDate, c.description, c.active,c.achieved, c.created_at, ct.name AS type
             FROM campaign c
             JOIN campaign_types ct ON c.type_id = ct.id
             WHERE c.user_id = ?`, // Filter by user ID
            [userId]
        );

        // Send the campaigns data as a JSON response
        res.status(200).json(campaigns);
    } catch (error) {
        // Handle errors
        console.error('Error fetching campaigns:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

router.post('/', verifyToken,
    [
        // Input validation using express-validator
        body('name').notEmpty().withMessage('Campaign name is required'),
        body('type').notEmpty().withMessage('Campaign type is required'),
        //body('dueDate').notEmpty().withMessage('Due date is required').isISO8601().withMessage('Due date must be a valid date'),
        body('description').notEmpty().withMessage('Description is required'),
    ],
    async (req, res) => {
        // 1. Input Validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        // 2. Extract data from the request body
        const { name, type, dueDate, description } = req.body;
        const userId = req.user.userId; // Get the user ID from the JWT.

        // Convert dueDate to a MySQL-compatible format
        const mysqlDueDate = new Date(dueDate).toISOString().slice(0, 19).replace('T', ' ');

        // 3. Database Interaction
        try {
            // Insert the new campaign into the database
            const campaignId = uuidv4();  // Generate a unique ID for the campaign.

            const result = await execute(
                'INSERT INTO campaign (id, name, description, dueDate, type_id, achieved, created_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [campaignId, name, description, mysqlDueDate, type, false, new Date().toLocaleDateString({ region: 'ISR' }), userId]
            );

            if (result.affectedRows === 1) {
                // 4. Send a success response
                res.status(201).json({ message: 'Campaign created successfully', campaignId: campaignId }); // Include the new campaign's ID in the response
            } else {
                // Handle the case where the insertion failed (though this is unlikely)
                res.status(500).json({ message: 'Failed to create campaign in the database' });
            }
        } catch (error) {
            // 5. Handle errors
            console.error('Error creating campaign:', error);
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }
);

router.get('/types', verifyToken, async (req, res) => {
    try {
        const types = await execute(
            'SELECT * FROM campaign_types'
        );
        console.log({ types })

        if (!types.length) {
            res.status(500).json({ message: `no types inserted yet` })
        }

        res.status(200).json({ types })
    } catch (error) {
        console.error('Error creating campaign:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
})
module.exports = router;