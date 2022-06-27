var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.use((req,res,next) => {
   console.log("in the index router")
   next()
})

module.exports = router;