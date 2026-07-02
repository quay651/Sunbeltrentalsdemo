import React, { useState, useEffect, useCallback } from "react";
import TechLogin from "./components/TechLogin";
import SessionListScreen from "./components/SessionListScreen";
import ChatScreen from "./components/ChatScreen";
import SearchScreen from "./components/SearchScreen";
import { listConversations, createConversation } from "./api";

// Mobile-first single-screen navigation: list -> chat, or list -> search.
// activeId === null && !showSearch -> session list ("home")
// activeId === <id>                -> chat screen for that session
// showSearch === true              -> search screen (across all technicians)
export default function App() {
  const [technician, setTechnician] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [showSearch, setShowSearch] = useState(false);

  const refreshConversations = useCallback(async () => {
    try {
      const data = await listConversations();
      setConversations(data);
    } catch (err) {
      // backend may not be up yet; ignore until tech logs in / retries
    }
  }, []);

  useEffect(() => {
    if (technician) refreshConversations();
  }, [technician, refreshConversations]);

  const handleCreate = async (payload) => {
    const convo = await createConversation(payload);
    setConversations((prev) => [convo, ...prev]);
    setActiveId(convo.id);
  };

  if (!technician) {
    return <TechLogin onLogin={setTechnician} />;
  }

  if (showSearch) {
    return <SearchScreen onBack={() => setShowSearch(false)} />;
  }

  if (activeId !== null) {
    return (
      <ChatScreen
        conversationId={activeId}
        technician={technician}
        onBack={() => {
          setActiveId(null);
          refreshConversations();
        }}
      />
    );
  }

  return (
    <SessionListScreen
      conversations={conversations}
      onSelect={setActiveId}
      onCreate={handleCreate}
      onOpenSearch={() => setShowSearch(true)}
      technician={technician}
    />
  );
}
