const express = require('express');
const app = express();
const port = process.env.NEXT_PUBLIC_BASE_URL || 5000;
const cors = require('cors');
require('dotenv').config();
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
// Middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// গ্লোবাল ভ্যারিয়েবল ডিক্লেয়ার করা হলো যেন সব রুট থেকে ডাটাবেজ এক্সেস করা যায়
let database, userCollection, lessonsCollection, likesCollection, savesCollection, reportsCollection, commentsCollection;

async function dbConnect() {
  try {
    // সার্ভারলেস ফাংশনে বারবার কানেক্ট হওয়া রোধ করতে এই চেকটি জরুরি
    if (!database) {
      await client.connect();
      database = client.db(process.env.AUTH_DB_NAME);
      
      // কালেকশনগুলো গ্লোবাল ভ্যারিয়েবলে অ্যাসাইন করা হচ্ছে
      userCollection = database.collection("user");
      lessonsCollection = database.collection("lessons");
      likesCollection = database.collection("likes");
      savesCollection = database.collection("saves");
      reportsCollection = database.collection("reports");
      commentsCollection = database.collection("comments");
      
      console.log("MongoDB Connected Successfully!");
    }
  } catch (error) {
    console.error("Database Connection Error:", error);
  }
}



// প্রতিবার রিকোয়েস্ট আসার সাথে সাথে ডাটাবেজ কানেকশন নিশ্চিত করার জন্য একটি মিডলওয়্যার
app.use(async (req, res, next) => {
  await dbConnect();
  next();
});

// লোকালহোস্ট রান করানোর জন্য টেস্ট লিসেনার
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server running locally on port ${port}`);
  });
}

// Vercel Serverless Function এর জন্য এক্সপোর্ট
module.exports = app;