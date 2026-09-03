import mongoose from "mongoose";
import { env } from "../config/env";

mongoose.set("strictQuery", true);

mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected");
});

export async function connectMongo(): Promise<typeof mongoose> {
  return mongoose.connect(env.MONGO_URI);
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
