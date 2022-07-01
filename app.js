var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const layouts = require("express-ejs-layouts");
const axios = require('axios');
const auth = require('./routes/auth');
const session = require("express-session");
const MongoDBStore = require('connect-mongodb-session')(session);

// *********************************************************** //
//  Loading models
// *********************************************************** //

const Record = require('./models/Record')

// *********************************************************** //
//  Connecting to the database
// *********************************************************** //

const mongoose = require( 'mongoose' );
const mongodb_URI = process.env.mongodb_URI;

mongoose.connect( mongodb_URI, { useNewUrlParser: true, useUnifiedTopology: true } );
// fix deprecation warnings
//mongoose.set('useFindAndModify', false); 
//mongoose.set('useCreateIndex', true);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {console.log("we are connected!!!")});

// middleware to test is the user is logged in, and if not, send them to the login page
const isLoggedIn = (req,res,next) => {
  if (res.locals.loggedIn) {
    next()
  }
  else res.redirect('/login')
}

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

var store = new MongoDBStore({
  uri: mongodb_URI,
  collection: 'mySessions'
});

// Catch errors
store.on('error', function(error) {
  console.log(error);
});

app.use(require('express-session')({
  secret: 'This is a secret lifyy3ig3obvbiv2cbwv2obpevp2vg2',
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
  },
  store: store,
  // Boilerplate options, see:
  // * https://www.npmjs.com/package/express-session#resave
  // * https://www.npmjs.com/package/express-session#saveuninitialized
  resave: true,
  saveUninitialized: true
}));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(layouts)
app.use(auth)
app.use('/', indexRouter);
app.use('/users', usersRouter);

app.get('/bmi',
  (req, res, next) => {
    res.render('bmi')
  }
)

app.post('/bmi',
  (req,res,next) => {
    const {weight, height,plan} = req.body;
    res.locals.height = height;
    res.locals.weight = weight;
    res.locals.BMI = weight/(height*height)*10000;
    res.locals.plan = plan
    res.locals.version = '1.0.0';
    if (res.locals.height===''||res.locals.weight===''){
      res.redirect('/bmi')
    }else{
      res.render('bmiresults')
  }}
)

app.get('/addBMI/:bmi',
   isLoggedIn,
   async (req,res,next) => {
    try {
      const bmiNum = 
         new Record(
          {
            userId:res.locals.user._id,
            bmi:req.params.bmi,
            recordedAt: new Date()}
          )
      await bmiNum.save();
      res.redirect('/bmi')
    }catch(e) {
      next(e)
    }
   }

)

app.get('/deleteBMI/:bmi',
    isLoggedIn,
    async (req,res,next) => {
      try {
        const bmi = req.params.bmi;
        await Record.deleteOne({_id:bmi});
        res.redirect('/showRecord');
      } catch(e){
        next(e);
      }
    }
)

app.get('/showRecord',
  isLoggedIn,
  async(req,res,next) => {
    try{
      const BMI = 
          await Record.find({userId:res.locals.user._id})
            .populate('userId')
      res.locals.BMI = BMI;
      res.render('records')

    }catch(e){
      next(e);
    }
  }
)


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;