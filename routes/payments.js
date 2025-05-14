const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth-resources');
const { v4: uuidv4 } = require('uuid');
const { execute } = require('../connection-wrapper');

// 1. Get payments by user_id
router.get('/', authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const sql = `SELECT pay.id, pay.description, pay.amount,pay.due_date,pay.status, pay.created_at,   JSON_OBJECT(
            'id', u.id,
            'name', CONCAT(ui.first_name, ' ', ui.last_name),
            'email', u.email
        ) AS user FROM payments pay
        LEFT JOIN user_info ui ON ui.id = pay.user_id
        LEFT JOIN user u ON u.id = pay.user_id
        WHERE pay.user_id = ?`;

        const values = [userId];
        const payments = await execute(sql, values);
        res.json(payments);
    } catch (error) {
        console.error('Error fetching user payments:', error);
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
});

// 2. create new payment
router.post('/', authenticate, authorize('payments', 'write'), async (req, res) => {
    try {
        const { description, amount, due_date } = req.body;

        // Check if the user is allowed to create payment requests for other users
        // if (user.role_id !== 100 && user.role_id !== 101) {
        //     return res.status(403).json({ error: 'Forbidden: You are not authorized to create payment requests for other users.' });
        // }

        if (!description || !amount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const paymentId = uuidv4();
        const sql = `
            INSERT INTO payments (id, user_id, description, amount, due_date)
            VALUES (?, ?, ?, ?, ?)
        `;

        const values = [paymentId, req.user.userId, description, amount, due_date];

        const result = await execute(sql, values);

        if (result.affectedRows > 0) {
            // Fetch the newly created payment
            const selectSql = `
          SELECT pay.*, JSON_OBJECT(
            'id', ui.id,
            'name', CONCAT(ui.first_name, ' ', ui.last_name),
            'email', u.email
        ) AS user FROM payments pay
          LEFT JOIN user_info ui ON ui.id = pay.user_id
          LEFT JOIN user u ON u.id = pay.user_id
          WHERE pay.id = ?`;

            const selectValues = [paymentId];
            const newPayment = await execute(selectSql, selectValues);

            res.status(201).json(newPayment[0]);
        }


    } catch (error) {
        console.error('Error creating payment request:', error);
        res.status(500).json({ error: 'Failed to create payment request' });
    }
});

// 3. Update payment's status
router.put('/:id', authenticate, authorize('payments', 'write'), async (req, res) => {
    try {
        const paymentId = req.params.id;
        const { status } = req.body;
        const userId = req.user.userId;

        const [pay] = await execute('SELECT * FROM payments WHERE id = ?', [paymentId]);

        if (!pay) {
            return res.status(404).json({ error: 'Message not found' });
        }

        if (pay.user_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Validate the status
        const allowedStatuses = ['pending', 'paid', 'overdue', 'cancelled'];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid payment status' });
        }

        const sql = 'UPDATE payments SET status = ? WHERE id = ?';
        const values = [status, paymentId];
        const result = await execute(sql, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        // Fetch the updated payment
        const selectSql = 'SELECT * FROM payments WHERE id = ?';
        const selectValues = [paymentId];
        const updatedPayment = await execute(selectSql, selectValues);

        res.status(200).json(updatedPayment[0]);

    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({ error: 'Failed to update payment status' });
    }
});



// 4. GET payments of all users
router.get('/all', authenticate, authorize('payments', 'write'), async (req, res) => {
    try {
        const sql = `SELECT pay.id, pay.description, pay.amount,pay.due_date,pay.status, pay.created_at,   JSON_OBJECT(
            'id', u.id,
            'name', CONCAT(ui.first_name, ' ', ui.last_name),
            'email', u.email
        ) AS user FROM payments pay
        LEFT JOIN user_info ui ON ui.id = pay.user_id
        LEFT JOIN user u ON u.id = pay.user_id`;

        const payments = await execute(sql, []);

        res.status(200).json(payments);

    } catch (error) {
        console.error('Error fetching all payments:', error);
        res.status(500).json({ error: 'Failed to fetch all payments' });
    }
});


module.exports = router;