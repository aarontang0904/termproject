'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;

var recordSchema = Schema( {
  userId: {type:Schema.Types.ObjectId, ref:'User'},
  bmi: {type: Number, default: 0},
} );

module.exports = mongoose.model( 'Record', recordSchema );