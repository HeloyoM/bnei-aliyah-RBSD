const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth');
const { execute } = require('../connection-wrapper');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');

// 1. GET all campaigns
router.get('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId; // Get the user ID from the JWT.

        // Query the database to get campaigns and their types
        const campaigns = await execute(
            `SELECT c.id, c.name AS campaign_name, c.dueDate, c.description, c.active, c.achieved, c.created_at, ct.name AS type, r.name
            FROM campaign c
            JOIN campaign_types ct ON c.type_id = ct.id
            JOIN user u ON u.id = c.user_id
            LEFT JOIN role r ON  r.level = u.role_id
            `
        );

        // Send the campaigns data as a JSON response
        res.status(200).json(campaigns);
    } catch (error) {
        // Handle errors
        console.error('Error fetching campaigns:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

// 2. Post new campaign
router.post('/', verifyToken,
    [
        // Input validation using express-validator
        body('name').notEmpty().withMessage('Campaign name is required'),
        body('type').notEmpty().withMessage('Campaign type is required'),
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
                'INSERT INTO campaign (id, name, description, dueDate, type_id, achieved, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [campaignId, name, description, mysqlDueDate, type, false, userId]
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

// 2. Get the cmpaigns types
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

// 3. Route to add a user to a campaign
router.post('/:campaignId/members', verifyToken, async (req, res) => {
    const { campaignId } = req.params;
    const userId = req.user.userId;

    //  Verify that the user making the request is allowed to add members (e.g., organizer)
    //  You'll need to implement your authorization logic here, based on your application's rules.
    //  For example, you might check if the current user (req.user) is the organizer of the campaign.

    try {
        // 1. Check if the campaign exists and is active.
        const campaignResult = await execute('SELECT id, active FROM campaign WHERE id = ?', [campaignId]);
        if (campaignResult.length === 0) {
            return res.status(404).json({ message: 'Campaign not found' });
        }
        if (!campaignResult[0].active) {
            return res.status(400).json({ message: 'Campaign is not active' });
        }

        // 2.  Check if the user exists
        const userResult = await execute('SELECT id FROM user WHERE id = ?', [userId]);
        if (userResult.length === 0) {
            return res.status(400).json({ message: 'User not found' });
        }

        // 3. Check if the user is already a member of the campaign
        const existingMemberResult = await execute(
            'SELECT id FROM members WHERE campaign_id = ? AND user_id = ?',
            [campaignId, userId]
        );
        if (existingMemberResult.length > 0) {
            return res.status(400).json({ message: 'User is already a member of this campaign' });
        }

        // 4. Add the user to the campaign
        const memberId = uuidv4();
        const result = await execute(
            'INSERT INTO members (id, campaign_id, user_id) VALUES (?, ?, ?)',
            [memberId, campaignId, userId]
        );

        if (result.affectedRows === 1) {
            res.status(201).json({ message: 'User added to campaign successfully', memberId });
        } else {
            res.status(500).json({ message: 'Failed to add user to campaign' });
        }
    } catch (error) {
        console.error('Error adding user to campaign:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

router.get('/:campaignId', verifyToken, async (req, res) => {
    const { campaignId } = req.params;
    const userId = req.user.userId;

    try {
        const campaignMembers = await execute(`
            SELECT mem.id, mem.joined_date, mem.status, mem.user_id AS member_id, ui.first_name, ui.last_name, u.phone, u.email FROM members mem
            JOIN user_info ui ON ui.id = mem.user_id
            JOIN user u ON u.id = mem.user_id
            WHERE campaign_id = ?
            `, [campaignId]);

        res.status(200).json(campaignMembers)
    } catch (error) {
        console.error(`Error fetching campaign's members:`, error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
})
module.exports = router;