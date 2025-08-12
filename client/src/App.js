import React, { useState, useRef, useEffect } from "react";

function App() {
  const [messages, setMessages] = useState([
    { type: "ai", text: "👋 Hi there! How can I assist you today?" },
  ]);
  const [userInput, setUserInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini");
  const [lastResponse, setLastResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [history, setHistory] = useState([]);
  const chatEndRef = useRef(null);
  const fullReplyRef = useRef("");

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchHistory = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/history");
      const data = await res.json();
      setHistory(data.history || []);
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  };

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory();
    }
  }, [activeTab]);

  const sendMessage = async () => {
    if (!userInput.trim()) return;

    const newUserMessage = { type: "user", text: userInput };
    const aiMessage = { type: "ai", text: "" };
    setMessages((prev) => [...prev, newUserMessage, aiMessage]);
    setLoading(true);
    fullReplyRef.current = "";

    try {
      const res = await fetch("http://localhost:5000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_message: userInput,
          selected_model: selectedModel,
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullReplyRef.current += chunk;

        await new Promise((r) => setTimeout(r, 30));
        setMessages((prevMessages) => {
          const updated = [...prevMessages];
          updated[updated.length - 1] = {
            type: "ai",
            text: fullReplyRef.current,
          };
          return updated;
        });
      }

      setLastResponse(fullReplyRef.current);
    } catch (err) {
      console.error("Error:", err);
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { type: "ai", text: "❌ Error fetching response." },
      ]);
    } finally {
      setUserInput("");
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("Response copied to clipboard!");
  };

  const exportChat = (format) => {
    const data =
      format === "json"
        ? JSON.stringify(messages, null, 2)
        : messages.map((m) => `${m.type.toUpperCase()}: ${m.text}`).join("\n");

    const blob = new Blob([data], {
      type: format === "json" ? "application/json" : "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `chat.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearChat = () => {
    setMessages([{ type: "ai", text: "👋 Hi there! How can I assist you today?" }]);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-2 py-4 sm:px-4 sm:py-6">
      <div className="w-full max-w-2xl h-[90vh] bg-white rounded-xl shadow-md flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <h1 className="text-lg font-semibold">Gemini Chat</h1>
          <select
            className="border rounded p-1 text-sm"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            <option value="gemini">Gemini</option>
            <option value="openai" disabled>OpenAI (Coming soon)</option>
            <option value="claude" disabled>Claude (Coming soon)</option>
          </select>
        </div>

        <div className="flex justify-center gap-2 sm:gap-4 p-2 border-b bg-gray-100 text-sm sm:text-base">
          <button
            onClick={() => setActiveTab("chat")}
            className={`px-3 py-1 rounded ${
              activeTab === "chat"
                ? "bg-blue-500 text-white"
                : "bg-white text-gray-700 border"
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-3 py-1 rounded ${
              activeTab === "history"
                ? "bg-blue-500 text-white"
                : "bg-white text-gray-700 border"
            }`}
          >
            History
          </button>
          <button
            onClick={clearChat}
            className="bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200"
          >
            Clear
          </button>
          <button
            onClick={() => exportChat("txt")}
            className="bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200"
          >
            Export .txt
          </button>
          <button
            onClick={() => exportChat("json")}
            className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded hover:bg-yellow-200"
          >
            Export .json
          </button>
        </div>

        <div className="flex-1 p-4 overflow-y-auto">
          {activeTab === "chat" ? (
            <>
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`mb-3 max-w-[80%] px-4 py-2 rounded-lg relative ${
                    msg.type === "user"
                      ? "bg-blue-500 text-white self-end ml-auto"
                      : "bg-gray-200 text-gray-800 self-start mr-auto"
                  }`}
                >
                  {msg.text}
                  {msg.type === "ai" && (
                    <button
                      onClick={() => copyToClipboard(msg.text)}
                      className="absolute top-1 right-1 text-xs text-gray-500 hover:text-gray-700"
                    >
                      📋
                    </button>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </>
          ) : history.length === 0 ? (
            <p className="text-center text-gray-500">No chat history found.</p>
          ) : (
            history.map((entry, idx) => (
              <div key={idx} className="mb-4">
                <div className="bg-blue-100 text-blue-900 px-4 py-2 rounded-lg max-w-[80%] ml-auto mb-1">
                  {entry.user_message}
                </div>
                <div className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg max-w-[80%] mr-auto">
                  {entry.ai_response}
                </div>
              </div>
            ))
          )}
        </div>

        {activeTab === "chat" && (
          <div className="border-t p-4">
            <textarea
              className="w-full border rounded-lg p-2 resize-none h-20"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
            />
            <button
              onClick={sendMessage}
              disabled={loading}
              className="mt-2 w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition"
            >
              {loading ? "Thinking..." : "Send"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
