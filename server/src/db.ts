import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGO_URI || "mongodb://mongo:27017/ecommerce";
  await mongoose.connect(uri);
  console.log("db connected");
}
