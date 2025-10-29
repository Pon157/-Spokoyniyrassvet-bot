const express = require('express');
const User = require('../models/User');
const Log = require('../models/Log');
const { requireRole } = require('../middleware');

const router = express.Router();

router.use(requireRole(['owner']));

router.post('/coowners', async (req, res) => {
    try {
        const { userId } = req.body;
        
        const user = await User.findByIdAndUpdate(
            userId,
            { role: 'coowner' },
            { new: true }
        ).select('-password');

        const log = new Log({
            action: 'coowner_added',
            userId: req.user._id,
            targetId: userId,
            details: { newRole: 'coowner' },
            timestamp: new Date()
        });
        await log.save();

        res.json({ message: 'Совладелец добавлен', user });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка добавления совладельца' });
    }
});

router.delete('/coowners/:userId', async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.userId,
            { role: 'admin' },
            { new: true }
        ).select('-password');

        const log = new Log({
            action: 'coowner_removed',
            userId: req.user._id,
            targetId: req.params.userId,
            details: { newRole: 'admin' },
            timestamp: new Date()
        });
        await log.save();

        res.json({ message: 'Совладелец удален', user });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка удаления совладельца' });
    }
});

module.exports = router;
