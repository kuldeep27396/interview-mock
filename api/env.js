export default function handler(req, res) {
    // Return environment variables to the client
    // Only include what's needed for the frontend
    res.status(200).json({
      GROQ_API_KEY: process.env.GROQ_API_KEY || null
    });
  }