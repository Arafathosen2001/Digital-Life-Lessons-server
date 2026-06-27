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

app.get('/', (req, res) => {
  res.send('Digital Lesson Server is Running...');
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await userCollection.find().toArray();
    res.send(users);
  } catch (error) {
    res.status(500).send({ message: "Users পাওয়া যায়নি", error });
  }
});
app.patch("/api/users/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const result = await userCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { role: "admin" } }
    );
    res.send(result);
  } catch (error) {
    res.status(500).send({ error });
  }
});

app.get('/api/user/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    let query = { _id: userId };
    if (ObjectId.isValid(userId)) {
      query = { _id: new ObjectId(userId) };
    }
    const author = await userCollection.findOne(query, { projection: { password: 0 } });
    if (!author) return res.status(404).send({ message: "Author not found" });
    res.send(author);
  } catch (error) {
    res.status(500).send({ message: "Server error", error });
  }
});

// --- LESSONS ROUTES ---
app.post('/api/lessons', async (req, res) => {
  try {
    const lesson = req.body;
    const newlesson = { ...lesson, createdAt: new Date() };
    const result = await lessonsCollection.insertOne(newlesson);
    res.status(201).send(result);
  } catch (error) {
    res.status(500).send({ message: "লেসন তৈরি করতে সমস্যা হয়েছে", error });
  }
});
// 
app.get('/api/lessons',verifyToken, async (req, res) => {
  try {
    const userId = req?.query.userId;
    const query = userId ? { userId } : {};
    const lessons = await lessonsCollection.find(query).toArray();
    res.send(lessons);
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error", error });
  }
});

app.get('/api/lessons/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) return res.status(400).send({ message: "Invalid ID" });
    const lesson = await lessonsCollection.findOne({ _id: new ObjectId(id) });
    res.send(lesson);
  } catch (error) {
    res.status(500).send({ error });
  }
});

app.put('/api/lessons/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) return res.status(400).send({ message: "Invalid ID" });
    const result = await lessonsCollection.updateOne({ _id: new ObjectId(id) }, { $set: { ...req.body } });
    res.send(result);
  } catch (error) {
    res.status(500).send({ error });
  }
});

app.delete('/api/lessons/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) return res.status(400).send({ message: "Invalid ID" });
    const result = await lessonsCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  } catch (error) {
    res.status(500).send({ error });
  }
});

// --- LIKES ROUTES ---
app.post('/api/lessons/:id/like', async (req, res) => {
  try {
    const lessonId = req.params.id;
    const { userId } = req.body;
    const existingLike = await likesCollection.findOne({ lessonId, userId });
    if (existingLike) {
      await likesCollection.deleteOne({ lessonId, userId });
      return res.send({ liked: false, message: "Like removed" });
    }
    await likesCollection.insertOne({ lessonId, userId, createdAt: new Date() });
    res.send({ liked: true, message: "Liked successfully" });
  } catch (error) {
    res.status(500).send({ error });
  }
});

app.get('/api/lessons/:id/like-status', async (req, res) => {
  try {
    const lessonId = req.params.id;
    const userId = req.query.userId;
    const totalLikes = await likesCollection.countDocuments({ lessonId });
    const isLiked = userId ? await likesCollection.findOne({ lessonId, userId }) : null;
    res.send({ totalLikes, isLiked: !!isLiked });
  } catch (error) {
    res.status(500).send({ error });
  }
});

// --- SAVES ROUTES ---
app.post('/api/lessons/:id/save', async (req, res) => {
  try {
    const lessonId = req.params.id;
    const { userId } = req.body;
    const existingSave = await savesCollection.findOne({ lessonId, userId });
    if (existingSave) {
      await savesCollection.deleteOne({ lessonId, userId });
      return res.send({ saved: false, message: "Removed from saves" });
    }
    await savesCollection.insertOne({ lessonId, userId, createdAt: new Date() });
    res.send({ saved: true, message: "Saved successfully" });
  } catch (error) {
    res.status(500).send({ error });
  }
});

app.get('/api/lessons/:id/save-status', async (req, res) => {
  try {
    const lessonId = req.params.id;
    const userId = req.query.userId;
    const totalSaves = await savesCollection.countDocuments({ lessonId });
    const isSaved = userId ? await savesCollection.findOne({ lessonId, userId }) : null;
    res.send({ totalSaves, isSaved: !!isSaved });
  } catch (error) {
    res.status(500).send({ error });
  }
});
// --- REPORT ROUTES ---
app.post('/api/lessons/:id/report', async (req, res) => {
  try {
    const lessonId = req.params.id;
    const { userId, reason } = req.body;
    const existingReport = await reportsCollection.findOne({ lessonId, userId });
    if (existingReport) return res.status(400).send({ message: "You have already reported this lesson." });
    
    const result = await reportsCollection.insertOne({
      lessonId, userId, reason: reason || "Inappropriate content", createdAt: new Date()
    });
    res.status(201).send({ success: true, insertedId: result.insertedId });
  } catch (error) {
    res.status(500).send({ error });
  }
});


// ✅ Ignore all reports for a lesson
app.delete("/api/reports/:lessonId", async (req, res) => {
  try {
    const lessonId = req.params.lessonId;

    const result = await reportsCollection.deleteMany({ lessonId });

    if (result.deletedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "No reports found for this lesson",
      });
    }

    res.send({
      success: true,
      message: "All reports for this lesson cleared successfully",
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      error: error.message,
    });
  }
});


// app.get('/api/reports', async (req, res) => {
//   const reports = await reportsCollection.find().toArray();
//   res.send(reports);
// });
app.get('/api/reports', async (req, res) => {
  try {
    const reports = await reportsCollection.aggregate([
      // lessonId কে ObjectId এ কনভার্ট
      {
        $addFields: {
          lessonObjId: {
            $cond: {
              if: { $regexMatch: { input: "$lessonId", regex: /^[0-9a-fA-F]{24}$/ } },
              then: { $toObjectId: "$lessonId" },
              else: "$lessonId"
            }
          },
          userObjId: {
            $cond: {
              if: { $regexMatch: { input: "$userId", regex: /^[0-9a-fA-F]{24}$/ } },
              then: { $toObjectId: "$userId" },
              else: "$userId"
            }
          }
        }
      },
      {
        $lookup: {
          from: "lessons",
          localField: "lessonObjId",
          foreignField: "_id",
          as: "lessonInfo"
        }
      },
      { $unwind: { path: "$lessonInfo", preserveNullAndEmptyArrays: true } },

      // ✅ Reporter info join with ObjectId
      {
        $lookup: {
          from: "user",
          localField: "userObjId",
          foreignField: "_id",
          as: "reporterInfo"
        }
      },
      { $unwind: { path: "$reporterInfo", preserveNullAndEmptyArrays: true } },

      {
        $group: {
          _id: "$lessonId",
          lessonId: { $first: "$lessonId" },
          title: { $first: "$lessonInfo.title" },
          reports: {
            $push: {
              reason: "$reason",
              reporterId: "$userId",
              reporterName: "$reporterInfo.name"
            }
          },
          reportCount: { $sum: 1 }
        }
      }
    ]).toArray();

    res.send(reports);
  } catch (error) {
    res.status(500).send({ error });
  }
});



app.get('/api/lessons/:id/report-status', async (req, res) => {
  try {
    const lessonId = req.params.id;
    const userId = req.query.userId;
    const isReported = userId ? await reportsCollection.findOne({ lessonId, userId }) : null;
    res.send({ isReported: !!isReported });
  } catch (error) {
    res.status(500).send({ error });
  }
});
app.delete("/api/reports/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const result = await reportsCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Report not found",
      });
    }

    res.send({
      success: true,
      message: "Report ignored successfully",
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      error: error.message,
    });
  }
});

// --- COMMENTS ROUTES ---
app.get('/api/lessons/:id/comments', async (req, res) => {
  try {
    const lessonId = req.params.id;
    const comments = await commentsCollection.find({ lessonId }).sort({ createdAt: -1 }).toArray();
    res.send(comments);
  } catch (error) {
    res.status(500).send({ error });
  }
});

app.post('/api/lessons/:id/comments', async (req, res) => {
  try {
    const lessonId = req.params.id;
    const { userId, commentText, userName, userAvatar } = req.body;
    const newComment = {
      lessonId, userId, commentText,
      userName: userName || "Anonymous User",
      userAvatar: userAvatar || "",
      createdAt: new Date()
    };
    const result = await commentsCollection.insertOne(newComment);
    res.status(201).send({ ...newComment, _id: result.insertedId });
  } catch (error) {
    res.status(500).send({ error });
  }
});













// লোকালহোস্ট রান করানোর জন্য টেস্ট লিসেনার
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server running locally on port ${port}`);
  });
}

// Vercel Serverless Function এর জন্য এক্সপোর্ট
module.exports = app;