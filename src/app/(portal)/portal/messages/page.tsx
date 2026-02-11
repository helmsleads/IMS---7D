"use client";

import { useEffect, useState, useRef } from "react";
import {
  MessageSquare,
  Plus,
  Send,
  Clock,
  CheckCircle,
  Check,
  X,
  AlertCircle,
  ChevronLeft,
} from "lucide-react";
import { useClient } from "@/lib/client-auth";
import Card from "@/components/ui/Card";
import {
  getMyConversations,
  getMyConversation,
  startConversation,
  sendPortalMessage,
  PortalConversation,
  PortalConversationWithMessages,
} from "@/lib/api/portal-messages";

export default function PortalMessagesPage() {
  const { client } = useClient();
  const [conversations, setConversations] = useState<PortalConversation[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<PortalConversationWithMessages | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  // New conversation modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newContent, setNewContent] = useState("");
  const [creating, setCreating] = useState(false);

  // Mobile view state
  const [mobileShowThread, setMobileShowThread] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchConversations = async () => {
      if (!client) return;

      try {
        const data = await getMyConversations(client.id);
        setConversations(data);

        // Auto-select first conversation on desktop
        if (data.length > 0 && window.innerWidth >= 768) {
          const firstConv = await getMyConversation(client.id, data[0].id);
          setSelectedConversation(firstConv);
        }
      } catch (err) {
        console.error("Failed to fetch conversations:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [client]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConversation?.messages]);

  const handleSelectConversation = async (conversationId: string) => {
    if (!client) return;

    setLoadingMessages(true);
    setMobileShowThread(true);

    try {
      const data = await getMyConversation(client.id, conversationId);
      setSelectedConversation(data);

      // Update unread count in list
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c))
      );
    } catch (err) {
      console.error("Failed to fetch conversation:", err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendMessage = async () => {
    if (!client || !selectedConversation || !newMessage.trim()) return;

    setSending(true);
    try {
      const message = await sendPortalMessage(
        selectedConversation.id,
        client.id,
        newMessage.trim()
      );

      // Add message to current view
      setSelectedConversation((prev) =>
        prev ? { ...prev, messages: [...prev.messages, message] } : prev
      );

      // Update last message preview in list
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConversation.id
            ? {
                ...c,
                last_message_at: new Date().toISOString(),
                last_message_preview:
                  newMessage.length > 100
                    ? newMessage.substring(0, 100) + "..."
                    : newMessage,
              }
            : c
        )
      );

      setNewMessage("");
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  const handleStartConversation = async () => {
    if (!client || !newSubject.trim() || !newContent.trim()) return;

    setCreating(true);
    try {
      const conversation = await startConversation(
        client.id,
        newSubject.trim(),
        newContent.trim()
      );

      // Add to list
      const newConv: PortalConversation = {
        id: conversation.id,
        subject: conversation.subject,
        status: conversation.status,
        last_message_at: conversation.last_message_at,
        created_at: conversation.created_at,
        unread_count: 0,
        last_message_preview:
          newContent.length > 100
            ? newContent.substring(0, 100) + "..."
            : newContent,
      };
      setConversations((prev) => [newConv, ...prev]);

      // Select the new conversation
      setSelectedConversation(conversation);
      setMobileShowThread(true);

      // Close modal and reset
      setShowNewModal(false);
      setNewSubject("");
      setNewContent("");
    } catch (err) {
      console.error("Failed to start conversation:", err);
    } finally {
      setCreating(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString("en-US", { weekday: "short" });
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  const formatMessageTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatMessageDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
    }
  };

  // Group messages by date
  const groupMessagesByDate = (
    messages: PortalConversationWithMessages["messages"]
  ) => {
    const groups: { date: string; messages: typeof messages }[] = [];
    let currentDate = "";

    messages.forEach((message) => {
      const messageDate = new Date(message.created_at).toDateString();
      if (messageDate !== currentDate) {
        currentDate = messageDate;
        groups.push({ date: message.created_at, messages: [message] });
      } else {
        groups[groups.length - 1].messages.push(message);
      }
    });

    return groups;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          <p className="text-gray-500 mt-1">
            Contact the 7 Degrees team
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          New Conversation
        </button>
      </div>

      {/* Split View Container */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden min-h-[600px] flex">
        {/* Conversations List */}
        <div
          className={`w-full md:w-80 lg:w-96 border-r border-gray-200 flex flex-col ${
            mobileShowThread ? "hidden md:flex" : "flex"
          }`}
        >
          {/* List Header */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <p className="font-medium text-gray-700">
              {conversations.length} conversation
              {conversations.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto">
            {conversations.length > 0 ? (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    selectedConversation?.id === conv.id
                      ? "bg-blue-50 border-l-4 border-l-blue-600"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`font-medium truncate ${
                        conv.unread_count > 0
                          ? "text-gray-900"
                          : "text-gray-700"
                      }`}
                    >
                      {conv.subject}
                    </p>
                    {conv.unread_count > 0 && (
                      <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate mt-1">
                    {conv.last_message_preview || "No messages yet"}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        conv.status === "open"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {conv.status === "open" ? "Open" : "Closed"}
                    </span>
                    <span className="text-xs text-gray-400">
                      {conv.last_message_at
                        ? formatTime(conv.last_message_at)
                        : formatTime(conv.created_at)}
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <MessageSquare className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">No conversations yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  Start a new conversation to contact support
                </p>
                <button
                  onClick={() => setShowNewModal(true)}
                  className="mt-4 text-blue-600 hover:text-blue-700 font-medium text-sm"
                >
                  Start a conversation
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Message Thread */}
        <div
          className={`flex-1 flex flex-col ${
            !mobileShowThread ? "hidden md:flex" : "flex"
          }`}
        >
          {selectedConversation ? (
            <>
              {/* Thread Header */}
              <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center gap-3">
                <button
                  onClick={() => setMobileShowThread(false)}
                  className="md:hidden p-2 -ml-2 hover:bg-gray-200 rounded-lg"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {selectedConversation.subject}
                  </p>
                  <p className="text-sm text-gray-500">
                    {selectedConversation.status === "open" ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        Open
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-400" />
                        Closed
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  </div>
                ) : (
                  groupMessagesByDate(selectedConversation.messages).map(
                    (group, groupIndex) => (
                      <div key={groupIndex}>
                        {/* Date Divider */}
                        <div className="flex items-center gap-4 my-4">
                          <div className="flex-1 h-px bg-gray-200" />
                          <span className="text-xs text-gray-400 font-medium">
                            {formatMessageDate(group.date)}
                          </span>
                          <div className="flex-1 h-px bg-gray-200" />
                        </div>

                        {/* Messages in this group */}
                        <div className="space-y-3">
                          {group.messages.map((message) => (
                            <div
                              key={message.id}
                              className={`flex ${
                                message.sender_type === "client"
                                  ? "justify-end"
                                  : "justify-start"
                              }`}
                            >
                              {/* 7D Support Message - Left side */}
                              {message.sender_type !== "client" && (
                                <div className="flex items-end gap-2 max-w-[80%]">
                                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                                    <span className="text-white text-xs font-bold">7D</span>
                                  </div>
                                  <div className="bg-gray-100 text-gray-900 rounded-2xl rounded-bl-md px-4 py-2.5">
                                    <p className="whitespace-pre-wrap">
                                      {message.content}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">
                                      {formatMessageTime(message.created_at)}
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* Client Message - Right side */}
                              {message.sender_type === "client" && (
                                <div className="bg-blue-600 text-white rounded-2xl rounded-br-md px-4 py-2.5 max-w-[80%]">
                                  <p className="whitespace-pre-wrap">
                                    {message.content}
                                  </p>
                                  <div className="flex items-center justify-end gap-1 mt-1">
                                    <span className="text-xs text-blue-200">
                                      {formatMessageTime(message.created_at)}
                                    </span>
                                    {/* Read status indicator */}
                                    {message.read_at ? (
                                      <span className="flex text-blue-200" title="Read">
                                        <CheckCircle className="w-3.5 h-3.5" />
                                      </span>
                                    ) : (
                                      <span className="text-blue-300" title="Sent">
                                        <Check className="w-3.5 h-3.5" />
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  )
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              {selectedConversation.status === "open" ? (
                <div className="p-4 border-t border-gray-200 bg-white">
                  <div className="flex items-end gap-3">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Type your message..."
                      rows={1}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      style={{ minHeight: "48px", maxHeight: "120px" }}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || sending}
                      className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Press Enter to send, Shift+Enter for new line
                  </p>
                </div>
              ) : (
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-2 text-gray-500">
                    <AlertCircle className="w-4 h-4" />
                    <p className="text-sm">
                      This conversation is closed. Start a new conversation if
                      you need assistance.
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <MessageSquare className="w-16 h-16 text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">
                Select a conversation to view messages
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Or start a new conversation with the team
              </p>
              <button
                onClick={() => setShowNewModal(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                New Conversation
              </button>
            </div>
          )}
        </div>
      </div>

      {/* New Conversation Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                New Conversation
              </h2>
              <button
                onClick={() => setShowNewModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="What can we help you with?"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Describe your question or issue..."
                  rows={5}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleStartConversation}
                disabled={!newSubject.trim() || !newContent.trim() || creating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {creating ? "Starting..." : "Start Conversation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
