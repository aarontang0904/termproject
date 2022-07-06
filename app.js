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
const User = require('./models/User')

// *********************************************************** //
//  Connecting to the database
// *********************************************************** //

const mongoose = require('mongoose');
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

app.get('/meals',
  async (req, res, next) => {
    res.locals.feedbackGreen = ""
    res.locals.feedbackRed = ""
    res.locals.calories = "?"
    res.locals.pressedRecord = false;
    res.render('meals');
  }
)

async function getCaloriesIntake(mealArray) {
  var caloriesIntake = 0;
  for (var i = 0; i < mealArray.length; i++) {
    const requestBody = {
      method: 'GET',
      url: 'https://edamam-edamam-nutrition-analysis.p.rapidapi.com/api/nutrition-data',
      params: {ingr: mealArray[i]},
      headers: {
        'X-RapidAPI-Key': '6f865d4e13msha0ebb086c6c763dp10d869jsn4d8bad75acd0',
        'X-RapidAPI-Host': 'edamam-edamam-nutrition-analysis.p.rapidapi.com'
      }
    };
    await axios.request(requestBody).then(
      function (response) {
        const calories = parseInt(response.data["calories"]);
        caloriesIntake += calories;
      }).catch(function (e) {
        console.error(e);
      })
  }; 
  return caloriesIntake;
}

app.post('/meals',
  async (req,res,next) => {
    let {plan, meals} = req.body;
    res.locals.feedbackGreen = ""
    res.locals.feedbackRed = ""
    const mealArray = meals.split(",");
    res.locals.mealsArray = mealArray;
    let caloriesIntake = await getCaloriesIntake(mealArray);
    if (res.locals.loggedIn) {
      const userRecords = await Record.find({userId:res.locals.user._id})
                      .populate('userId')
      if (userRecords.length !== 0) {
        const record = userRecords[userRecords.length - 1];
        const BMR = record["bmr"];
        let mealRecord = ""
        if (record["meals"] !== "No data") {
          mealRecord = record["meals"];
        } 
        meals = meals + ", " + mealRecord;
        meals = meals.replace(/ /g, '').split(/,/g);
        const counts = {};
        for (const meal of meals) {
          if (meal === "") {
            continue;
          }
          const num = parseInt(meal, 10);
          const food = meal.replace(/[0-9]/g, '');
          counts[food] = counts[food] ? counts[food] + num : num;
        }
        meals = ""
        for (const [key, value] of Object.entries(counts)) {
          meals += (value.toString() + " " + key + ", ")
        }
        caloriesIntake = record["calories"] + caloriesIntake;
        const BMRCalories = BMR * 1.2;
        if (plan === "Gain weight") {
          if ( caloriesIntake >= BMRCalories + 500 ) {
            res.locals.feedbackGreen = "Good! Your calories intake today has met the expectation."
          } else {
            res.locals.feedbackRed = "Oh no! Your calories intake today has not met the expectation. You ate too little!"
          }
        }
        else if (plan === "Keep weight") {
          if ( BMRCalories - 500 < caloriesIntake < BMRCalories + 500 ) {
            res.locals.feedbackGreen = "Good! Your calories intake today has met the expectation."
          } else if ( BMRCalories - 500 >= caloriesIntake ) {
            res.locals.feedbackRed = "Oh no! Your calories intake today has not met the expectation. You ate too little!"
          } else {
            res.locals.feedbackRed = "Oh no! Your calories intake today has not met the expectation. You ate too much!"
          }
        } else {
          if ( caloriesIntake <= BMRCalories - 500 ) {
            res.locals.feedbackRed = "Oh no! Your calories intake today has not met the expectation. You ate too much!"
          } else {
            res.locals.feedbackGreen = "Good! Your calories intake today has met the expectation."
          }
        }
        const update = { meals: meals, calories: caloriesIntake };
        await Record.findOneAndUpdate(
          {userId:res.locals.user._id, recordedAt: record["recordedAt"]},
          update
        );
      } else {
        res.locals.feedbackRed = "Please add an BMI record first before getting a feedback!"
      }
    } else {
      res.locals.feedbackRed = "Please log in to record your diet."
    }
    res.locals.calories = caloriesIntake;
    res.locals.meals = meals;
    res.locals.pressedRecord = true;
    res.render('meals')
  }
)

app.get('/bmi',
  (req, res, next) => {
    res.render('bmi')
  }
)

app.post('/bmi',
  async (req,res,next) => {
    const {weight, height} = req.body;
    const BMI = weight/(height*height)*10000;
    // calculate BMR
    if (res.locals.loggedIn) {
      const userData = await User.find({username:res.locals.username})
                      .populate('username');
      const gender = userData[0]["gender"];
      const age = userData[0]["age"];
      var BMR;
      if (gender === "Male") {
        BMR = 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age)
      } else {
        BMR = 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age)
      }
      res.locals.BMR = BMR;
    }
    res.locals.height = height;
    res.locals.weight = weight;
    res.locals.BMI = BMI;
    res.locals.BMR = 0; 
    res.locals.version = '1.0.0';
    res.locals.added = ""
    if (res.locals.height===''||res.locals.weight===''){
      res.redirect('/bmi')
    } else {
      res.render('bmiresults')
  }
}
)

app.get('/addBMI/:bmi/:bmr',
   isLoggedIn,
   async (req,res,next) => {
    try {
      const bmiNum = 
         new Record(
          {
            userId:res.locals.user._id,
            bmi:req.params.bmi,
            bmr:req.params.bmr,
            recordedAt: new Date()}
          )
      await bmiNum.save();
      res.render('bmiresults', {BMI: req.params.bmi, BMR:req.params.bmr, added: "Record added successfully!"});
      // res.redirect('/bmi')
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