The calories intake feedback function at the /meals endpoint estimate one’s daily calories requirement in order to gain, keep, or lose weight based on one’s BMR. 
BMR represents an estimate of calories burned while resting. In this project, we use the revised Harris-Benedict Equation for one’s BMR estimation. 
The referenced formulas are listed below:
- Men BMR: 88.362 + (13.397 * weight in kg) + (4.799 * height in cm) - (5.677 * age in years)
- Women BMR: 447.593 + (9.247 * weight in kg) + (3.098 * height in cm) - (4.330 * age in years)

According to the Harris-Benedict Principle, 
to maintain weight, an individual’s daily Kilocalorie intake should be between BMR * 1.2 - 500 and BMR * 1.2 + 500; 
to lose weight, the intake should be less than BMR * 1.2 - 500 Kcal; 
and to gain weight, the intake should be more than BMR * 1.2 + 500 Kcal. 

One thing to note is the total calories intake calculator at the /meals endpoint uses an online API to fetch data of the calories of the input food. 
The API has a hard limit of posting 100 requests per day. 
If the hard limit is exceeded in a day, the API will return an error response and calories intake calculator will return a value of 0 calorie for any input. 
Thus, please press the record button less than 100 times per day for testing purpose. 
