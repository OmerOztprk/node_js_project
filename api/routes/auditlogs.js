const express = require('express');
const router = express.Router();

/* GET users listing. */
router.get('/:id', (req, res, next) => {
  res.json({
    body: req.body,
    parans: req.params,
    query: req.query,
    headers: req.headers
  })
});

module.exports = router;
