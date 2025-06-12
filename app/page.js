"use client"
import MarkdownRenderer from "@/app/components/MarkdownRenderer";
import { RiChatNewLine, RiGoogleFill, RiLogoutBoxLine, RiMenuLine } from "react-icons/ri";
import { useState, useEffect } from 'react';
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  // User // User type can be implicitly inferred or explicitly imported if strict typing is enforced elsewhere
} from "firebase/auth";
import {db} from "@/app/firebase/config"; // Adjust the import path as necessary
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  serverTimestamp,
  onSnapshot,
  doc,
  setDoc,
  getDoc,
  writeBatch,
  getDocs
} from 'firebase/firestore';
import ChatSidebar from './components/ChatSidebar';

// Your web app's Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase (ensure it's only initialized once)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

const ChatComponent = () => {
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [messages, setMessages] = useState([]); // Add this with other state declarations
  const [currentChatId, setCurrentChatId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Add this after other useEffect hooks
  useEffect(() => {
    let unsubscribe = () => {}; // Initialize with empty function

    const fetchMessages = async () => {
      if (user && currentChatId) {
        const messagesRef = collection(db, "aurora", user.uid, "chats", currentChatId, "messages");
        const q = query(messagesRef, orderBy("timestamp", "asc"));
        
        unsubscribe = onSnapshot(q, (snapshot) => {
          const fetchedMessages = snapshot.docs.map(doc => doc.data());
          setMessages(fetchedMessages);
        });
      }
    };

    fetchMessages();
    
    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [user, currentChatId]);

  const handleChatSelect = async (chatId) => {
    setCurrentChatId(chatId);
    // Clear the current messages and load messages for selected chat
    setMessages([]);
    if (chatId) {
      const messagesRef = collection(db, "aurora", user.uid, "chats", chatId, "messages");
      const q = query(messagesRef, orderBy("timestamp", "asc"));
      
      onSnapshot(q, (snapshot) => {
        const fetchedMessages = snapshot.docs.map(doc => doc.data());
        setMessages(fetchedMessages);
      });
    }
  };

  // Add this function after handleChatSelect
  const handleNewChat = () => {
    setCurrentChatId(null);
    setMessages([]);
    setResponse('');
    setInput('');
  };

  // Add this after handleNewChat
  const handleDeleteChat = async (chatId) => {  // Added curly brace here
    if (!user || !chatId) return;
    
    try {
      // Delete the chat document and all its messages
      const chatRef = doc(db, "aurora", user.uid, "chats", chatId);
      const messagesRef = collection(chatRef, "messages");
      
      // Delete all messages first
      const q = query(messagesRef);
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      // Delete the chat document itself
      batch.delete(chatRef);
      
      // Commit the batch
      await batch.commit();
      
      // Reset UI state if the deleted chat was the current one
      if (chatId === currentChatId) {
        handleNewChat();
      }
    } catch (error) {
      console.error("Error deleting chat:", error);
      alert("Failed to delete chat");
    }
  };

  const generateResponse = async (inputText) => {
    if (!user) {
      alert("Please sign in to chat.");
      return;
    }
    
    try {
      let chatId = currentChatId;
      // Create a new chat if none is selected
      if (!chatId) {
        const chatRef = doc(collection(db, "aurora", user.uid, "chats"));
        await setDoc(chatRef, {
          createdAt: serverTimestamp(),
          title: inputText.slice(0, 50)
        });
        chatId = chatRef.id;
        setCurrentChatId(chatId);
      }

      setLoading(true);
      setResponse('');

      const messagesRef = collection(db, "aurora", user.uid, "chats", chatId, "messages");
      await addDoc(messagesRef, {
        content: inputText,
        role: 'user',
        timestamp: serverTimestamp(),
      });

      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_GENAI_API_KEY;

      if (!apiKey) {
        throw new Error("NEXT_PUBLIC_GOOGLE_GENAI_API_KEY is not set.");
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-04-17' });

      const generationConfig = {
        temperature: 0.7,
        maxOutputTokens: 2048,
      };

      // Create chat history from messages array with correct role mapping
      const chat = model.startChat({
        history: messages.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user', // Map 'assistant' to 'model'
          parts: [{ text: msg.content }]
        })),
        generationConfig,
      });

      const result = await chat.sendMessageStream(inputText);

      let fullStreamedResponse = '';
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullStreamedResponse += chunkText;
        setResponse(fullStreamedResponse);
      }

      await addDoc(messagesRef, {
        content: fullStreamedResponse,
        role: 'assistant',
        timestamp: serverTimestamp(),
      });

    } catch (error) {
      console.error('Error:', error);
      setResponse(`Error: ${error.message || 'Could not generate response.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    await generateResponse(input);
    setInput('');
  };

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      setAuthLoading(true);
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      console.log("User signed in:", user);

      // Check if user document exists
      const userDocRef = doc(db, "aurora", user.uid);
      const userDoc = await getDoc(userDocRef);

      // If document doesn't exist, create it
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString()
        });
      } else {
        // Update last login time if document exists
        await setDoc(userDocRef, {
          lastLogin: new Date().toISOString()
        }, { merge: true });
      }
    } catch (error) {
      console.error("Error signing in with Google:", error);
      alert(`Sign-in error: ${error.message}`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setAuthLoading(true);
      await signOut(auth);
      setResponse('');
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setAuthLoading(false);
    }
  };

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-rose-300 to-rose-400 text-white text-xl">Loading authentication...</div>;
  }

  return (
    <div className="flex min-w-screen w-full min-h-screen h-full p-4 bg-gradient-to-br from-rose-300 to-rose-400">
      {/* Sidebar backdrop - show on all screen sizes when sidebar is open */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {user && (
        <ChatSidebar 
          user={user}
          onChatSelect={(chatId) => {
            handleChatSelect(chatId);
            setIsSidebarOpen(false);
          }}
          currentChatId={currentChatId}
          onNewChat={handleNewChat}
          onDeleteChat={handleDeleteChat}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        />
      )}
      
      <div className={`flex flex-col w-full transition-all duration-300 ${user && isSidebarOpen ? 'md:ml-64' : ''}`}>
        <header className="flex items-center justify-between mb-4 p-2 bg-rose-500/30 rounded-lg">
          <div className="flex items-center gap-2">
            {user && (
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600"
              >
                <RiMenuLine />
              </button>
            )}
            <div className="text-xl font-bold text-black">
              Chat with Aurora
            </div>
          </div>
          {user ? (
            <div className="flex items-center gap-3">
              {user.photoURL && <img src={user.photoURL} alt={user.displayName || "User"} className="w-8 h-8 rounded-full"/>}
              <span className="text-sm text-black hidden sm:inline">{user.displayName || user.email}</span>
              <button
                onClick={handleSignOut}
                className="px-3 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 flex items-center gap-1"
              >
                <RiLogoutBoxLine /> Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={handleGoogleSignIn}
              className="px-4 py-2 bg-white text-rose-600 border border-rose-600 rounded-lg hover:bg-rose-50 flex items-center gap-2"
            >
              <RiGoogleFill /> Sign in with Google
            </button>
          )}
        </header>

        {user ? (
          <>
            {/* Chat display area */}
            <div className="flex-grow overflow-y-auto mb-4 p-4 bg-rose-100 rounded-lg shadow-md min-h-[200px]">
              {messages.map((message, index) => (
                <div 
                  key={index} 
                  className={`mb-4 ${
                    message.role === 'user' ? 'text-right' : 'text-left'
                  }`}
                >
                  <div 
                    className={`inline-block p-3 rounded-lg ${
                      message.role === 'user' 
                        ? 'bg-rose-500 text-white' 
                        : 'bg-white text-black'
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      <MarkdownRenderer markdownContent={message.content} />
                    ) : (
                      <p>{message.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="text-center">
                  Thinking...
                  <div className="animate-pulse mt-2">✨</div>
                </div>
              )}
            </div>


            <form onSubmit={handleSubmit} className="mt-auto p-4 bg-rose-500/10 rounded-b-lg">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask Aurora anything..."
                  className="flex-1 p-3 rounded-lg border-2 bg-rose-50 border-rose-200 focus:outline-none focus:border-rose-500 text-black"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="px-5 py-3 bg-rose-500 text-white rounded-lg hover:bg-rose-600 disabled:bg-rose-300 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-grow flex items-center justify-center">
            <p className="text-xl text-center text-black/70 bg-rose-100/50 p-6 rounded-lg shadow">
              Please sign in to start chatting with Aurora.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatComponent;