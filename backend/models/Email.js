import mongoose from "mongoose";

const EmialSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    verified: { type: Boolean, default: false }
}, { timestamps: true
})

export default mongoose.model('Email', EmialSchema)