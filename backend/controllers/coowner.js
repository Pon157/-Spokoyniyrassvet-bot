const express = require('express');
const router = express.Router();

router.get('/test', (req, res) => {
    res.json({ message: 'Coowner route works' });
});

module.exports = router;
