from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import os
import sqlite3
from datetime import datetime
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Get API key
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not found in .env file")

# Configure Gemini
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("models/gemini-1.5-flash")

# --- Setup SQLite ---
DB_PATH = "chat_history.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS chat (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_message TEXT NOT NULL,
            ai_response TEXT NOT NULL,
            model TEXT NOT NULL,
            timestamp TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

init_db()

# --- Save chat to DB ---
def save_to_db(user_msg, ai_resp, model):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "INSERT INTO chat (user_message, ai_response, model, timestamp) VALUES (?, ?, ?, ?)",
        (user_msg, ai_resp, model, datetime.utcnow().isoformat())
    )
    conn.commit()
    conn.close()

# --- API Endpoints ---

@app.route("/api/hello", methods=["GET"])
def hello():
    return jsonify({"message": "Hello from Python backend!"})

@app.route("/api/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json()
        user_message = data.get("user_message", "").strip()
        selected_model = data.get("selected_model", "gemini")

        if not user_message:
            return jsonify({"error": "User message is required"}), 400

        gemini_stream = model.generate_content(user_message, stream=True)

        def stream_chunks():
            full_reply = ""
            try:
                for chunk in gemini_stream:
                    if chunk.text:
                        full_reply += chunk.text
                        yield chunk.text
            except Exception as e:
                yield f"\n[Stream error: {str(e)}]"
            finally:
                save_to_db(user_message, full_reply, selected_model)

        return Response(stream_chunks(), content_type='text/plain')

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/history", methods=["GET"])
def history():
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT user_message, ai_response, model, timestamp FROM chat ORDER BY id DESC LIMIT 20")
        rows = c.fetchall()
        conn.close()

        chat_history = [
            {
                "user_message": row[0],
                "ai_response": row[1],
                "model": row[2],
                "timestamp": row[3]
            }
            for row in rows
        ]

        return jsonify({"history": chat_history})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Run server
if __name__ == "__main__":
    app.run(debug=True)
