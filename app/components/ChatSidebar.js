import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/app/firebase/config';
import { RiChatNewLine, RiDeleteBin6Line, RiMenuLine, RiCloseLine } from 'react-icons/ri';

const ChatSidebar = ({ user, onChatSelect, currentChatId, onNewChat, onDeleteChat, isOpen, onToggle }) => {
  const [chats, setChats] = useState([]);

  useEffect(() => {
    if (!user) return;

    const chatsRef = collection(db, "aurora", user.uid, "chats");
    const q = query(chatsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setChats(chatsList);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <div className={`fixed md:fixed z-50 transition-all duration-300 ${
      isOpen ? "left-0" : "-left-64"
    }`}>
      <div className={`w-64 bg-rose-100 p-4 rounded-lg h-[calc(100vh-2rem)] ${
        isOpen ? "overflow-y-auto" : "overflow-hidden"
      }`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-rose-800">Previous Chats</h2>
          <div className="flex gap-2">
            <button
              onClick={onNewChat}
              className="p-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 flex items-center gap-1"
              aria-label="New Chat"
            >
              <RiChatNewLine />
            </button>
            <button
              onClick={onToggle}
              className="p-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600"
              aria-label="Toggle Sidebar"
            >
              {isOpen ? <RiCloseLine /> : <RiMenuLine />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {chats.map((chat) => (
            <div key={chat.id} className="flex items-center gap-2">
              <button
                onClick={() => onChatSelect(chat.id)}
                className={`flex-1 p-2 text-left rounded-lg transition-colors ${
                  currentChatId === chat.id
                    ? 'bg-rose-500 text-white'
                    : 'hover:bg-rose-200 text-rose-900'
                }`}
              >
                <p className="truncate">
                  {chat.title.length > 20 ? chat.title.slice(0, 20) + "..." : chat.title || 'New Chat'}
                </p>

                <p className="text-xs opacity-70">
                  {chat.createdAt?.toDate().toLocaleDateString()}
                </p>
              </button>
              <button
                onClick={() => onDeleteChat(chat.id)}
                className="px-2 py-4 text-rose-600 hover:bg-rose-200 rounded-lg"
                aria-label="Delete chat"
              >
                <RiDeleteBin6Line />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChatSidebar;