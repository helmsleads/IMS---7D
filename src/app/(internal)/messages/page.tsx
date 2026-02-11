"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Send,
  Search,
  Plus,
  CheckCircle,
  RotateCcw,
  Check,
  X,
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import FetchError from "@/components/ui/FetchError";
import {
  getConversations,
  getMessages,
  sendMessage,
  markAllRead,
  closeConversation,
  updateConversation,
  createConversation,
  ConversationWithMessages,
} from "@/lib/api/messages";
import { getClients, Client } from "@/lib/api/clients";
import { Message, ConversationStatus } from "@/types/database";
import { useAuth } from "@/lib/auth-context";
import { handleApiError } from "@/lib/utils/error-handler";

const statusOptions: { value: ConversationStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "archived", label: "Archived" },
];

const formatDate = (dateString: string | null) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
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
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export default function MessagesPage() {
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [conversations, setConversations] = useState<ConversationWithMessages[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<ConversationWithMessages | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | "">("");

  // New message
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  // New conversation modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newConversationClient, setNewConversationClient] = useState("");
  const [newConversationSubject, setNewConversationSubject] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchConversations = async () => {
    setLoading(true);
    setError(null);
    try {
      const [conversationsData, clientsData] = await Promise.all([
        getConversations({
          status: statusFilter || undefined,
        }),
        getClients(),
      ]);
      setConversations(conversationsData);
      setClients(clientsData);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const messagesData = await getMessages(conversationId);
      setMessages(messagesData);
      // Mark all as read
      await markAllRead(conversationId);
      // Refresh conversations to update unread counts
      const conversationsData = await getConversations({
        status: statusFilter || undefined,
      });
      setConversations(conversationsData);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [statusFilter]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
    }
  }, [selectedConversation?.id]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filteredConversations = useMemo(() => {
    if (!searchTerm) return conversations;
    const search = searchTerm.toLowerCase();
    return conversations.filter(
      (c) =>
        c.subject.toLowerCase().includes(search) ||
        c.client?.company_name.toLowerCase().includes(search)
    );
  }, [conversations, searchTerm]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;

    const messageContent = newMessage.trim();
    const now = new Date().toISOString();

    // Create optimistic message
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: selectedConversation.id,
      sender_type: "user",
      sender_id: user.id,
      content: messageContent,
      read_at: null,
      created_at: now,
    };

    // Optimistic update: add message to thread immediately
    setMessages((prev) => [...prev, optimisticMessage]);

    // Clear input immediately for better UX
    setNewMessage("");

    // Update conversation's last_message_at in local state
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConversation.id
          ? { ...c, last_message_at: now, messages: [...c.messages, optimisticMessage] }
          : c
      )
    );

    setSending(true);
    try {
      // Send message to server
      const sentMessage = await sendMessage(
        selectedConversation.id,
        messageContent,
        "user",
        user.id
      );

      // Replace optimistic message with real one
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticMessage.id ? sentMessage : m))
      );

      // Update conversations list with real message
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConversation.id
            ? {
                ...c,
                last_message_at: sentMessage.created_at,
                messages: c.messages.map((m) =>
                  m.id === optimisticMessage.id ? sentMessage : m
                ),
              }
            : c
        )
      );
    } catch (err) {
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConversation.id
            ? {
                ...c,
                messages: c.messages.filter((m) => m.id !== optimisticMessage.id),
              }
            : c
        )
      );
      // Restore message in input
      setNewMessage(messageContent);
      setError(handleApiError(err));
    } finally {
      setSending(false);
    }
  };

  const handleCloseConversation = async () => {
    if (!selectedConversation) return;

    try {
      await closeConversation(selectedConversation.id);
      await fetchConversations();
      // Update selected conversation status locally
      setSelectedConversation({ ...selectedConversation, status: "closed" });
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const handleReopenConversation = async () => {
    if (!selectedConversation) return;

    try {
      await updateConversation(selectedConversation.id, { status: "open" });
      await fetchConversations();
      // Update selected conversation status locally
      setSelectedConversation({ ...selectedConversation, status: "open" });
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const handleCreateConversation = async () => {
    if (!newConversationClient || !newConversationSubject.trim()) return;

    setCreating(true);
    try {
      const conversation = await createConversation(
        newConversationClient,
        newConversationSubject.trim()
      );
      setShowNewModal(false);
      setNewConversationClient("");
      setNewConversationSubject("");
      await fetchConversations();
      // Select the new conversation
      const newConv = await getConversations({ status: undefined });
      const created = newConv.find((c) => c.id === conversation.id);
      if (created) {
        setSelectedConversation(created);
      }
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setCreating(false);
    }
  };

  const getUnreadCount = (conversation: ConversationWithMessages) => {
    return conversation.messages.filter(
      (m) => m.sender_type === "client" && !m.read_at
    ).length;
  };

  const getLastMessage = (conversation: ConversationWithMessages) => {
    if (conversation.messages.length === 0) return null;
    return conversation.messages[conversation.messages.length - 1];
  };

  if (error && conversations.length === 0) {
    return (
      <AppShell title="Messages" subtitle="Client communications">
        <FetchError message={error} onRetry={fetchConversations} />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Messages"
      subtitle="Client communications"
      actions={
        <Button onClick={() => setShowNewModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Conversation
        </Button>
      }
    >
      <div className="flex gap-6 h-[calc(100vh-200px)] min-h-[500px]">
        {/* Conversation List */}
        <div className="w-80 flex-shrink-0 flex flex-col bg-white rounded-lg shadow-md overflow-hidden">
          {/* Filters */}
          <div className="p-4 border-b border-gray-200 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-1">
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setStatusFilter(option.value as ConversationStatus | "")}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    statusFilter === option.value
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
                    <div className="h-3 bg-gray-100 rounded w-full"></div>
                  </div>
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No conversations found
              </div>
            ) : (
              filteredConversations.map((conversation) => {
                const unreadCount = getUnreadCount(conversation);
                const lastMessage = getLastMessage(conversation);
                const isSelected = selectedConversation?.id === conversation.id;

                return (
                  <button
                    key={conversation.id}
                    onClick={() => setSelectedConversation(conversation)}
                    className={`w-full p-4 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      isSelected ? "bg-blue-50" : ""
                    } ${unreadCount > 0 ? "bg-blue-50/50" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Status Indicator */}
                      <div className="flex-shrink-0 mt-1">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${
                            conversation.status === "open"
                              ? "bg-green-500"
                              : conversation.status === "closed"
                              ? "bg-gray-400"
                              : "bg-yellow-500"
                          }`}
                          title={conversation.status}
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`font-medium truncate ${unreadCount > 0 ? "text-gray-900" : "text-gray-700"}`}>
                            {conversation.client?.company_name}
                          </span>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {formatDate(conversation.last_message_at)}
                          </span>
                        </div>
                        <p className={`text-sm truncate ${unreadCount > 0 ? "text-gray-700" : "text-gray-500"}`}>
                          {conversation.subject}
                        </p>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <p className="text-xs text-gray-400 truncate flex-1">
                            {lastMessage ? (
                              <>
                                {lastMessage.sender_type === "user" && (
                                  <span className="text-gray-500">You: </span>
                                )}
                                {lastMessage.content.length > 50
                                  ? lastMessage.content.slice(0, 50) + "..."
                                  : lastMessage.content}
                              </>
                            ) : (
                              <span className="italic">No messages yet</span>
                            )}
                          </p>
                          {unreadCount > 0 && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-blue-600 text-white rounded-full flex-shrink-0">
                              {unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 flex flex-col bg-white rounded-lg shadow-md overflow-hidden">
          {selectedConversation ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link
                        href={`/clients/${selectedConversation.client_id}`}
                        className="text-lg font-semibold text-gray-900 hover:text-blue-600 truncate"
                      >
                        {selectedConversation.client?.company_name}
                      </Link>
                      <Badge
                        variant={
                          selectedConversation.status === "open"
                            ? "success"
                            : selectedConversation.status === "closed"
                            ? "default"
                            : "warning"
                        }
                      >
                        {selectedConversation.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 truncate">
                      {selectedConversation.subject}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {selectedConversation.status === "open" ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleCloseConversation}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Close Conversation
                      </Button>
                    ) : selectedConversation.status === "closed" ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleReopenConversation}
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Reopen
                      </Button>
                    ) : null}
                    <button
                      onClick={() => setSelectedConversation(null)}
                      className="p-1 text-gray-400 hover:text-gray-600 lg:hidden"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    No messages yet. Start the conversation!
                  </div>
                ) : (
                  <>
                    {messages.map((message) => {
                      const isStaff = message.sender_type === "user";
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isStaff ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[70%] ${
                              isStaff ? "items-end" : "items-start"
                            }`}
                          >
                            {/* Sender Name */}
                            <p
                              className={`text-xs font-medium mb-1 ${
                                isStaff ? "text-right text-blue-600" : "text-gray-600"
                              }`}
                            >
                              {isStaff ? "You" : selectedConversation.client?.company_name}
                            </p>
                            {/* Message Bubble */}
                            <div
                              className={`rounded-lg p-3 shadow-sm ${
                                isStaff
                                  ? "bg-blue-600 text-white rounded-br-sm"
                                  : "bg-white text-gray-900 rounded-bl-sm"
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap">
                                {message.content}
                              </p>
                            </div>
                            {/* Timestamp and Read Indicator */}
                            <div
                              className={`flex items-center gap-1 mt-1 ${
                                isStaff ? "justify-end" : "justify-start"
                              }`}
                            >
                              <span
                                className={`text-xs ${
                                  isStaff ? "text-gray-500" : "text-gray-400"
                                }`}
                              >
                                {formatMessageTime(message.created_at)}
                              </span>
                              {/* Read indicator for staff messages */}
                              {isStaff && (
                                <span className="text-xs">
                                  {message.read_at ? (
                                    <span className="text-blue-500" title="Read">
                                      <Check className="w-3 h-3 inline" />
                                      <Check className="w-3 h-3 inline -ml-1.5" />
                                    </span>
                                  ) : (
                                    <span className="text-gray-400" title="Sent">
                                      <Check className="w-3 h-3 inline" />
                                    </span>
                                  )}
                                </span>
                              )}
                              {/* Read indicator for client messages */}
                              {!isStaff && message.read_at && (
                                <span className="text-xs text-green-500" title="Read">
                                  <Check className="w-3 h-3 inline" />
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Message Input */}
              {selectedConversation.status === "open" ? (
                <div className="p-4 border-t border-gray-200 bg-white">
                  <div className="flex gap-3">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..."
                      rows={3}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={sending || !newMessage.trim()}
                      className="self-end"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Send
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Press Enter to send, Shift+Enter for new line
                  </p>
                </div>
              ) : (
                <div className="p-4 border-t border-gray-200 bg-gray-50 text-center">
                  <p className="text-sm text-gray-500">
                    This conversation is {selectedConversation.status}.
                    {selectedConversation.status === "closed" && (
                      <button
                        onClick={handleReopenConversation}
                        className="ml-1 text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Reopen to reply
                      </button>
                    )}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={<MessageSquare className="w-12 h-12" />}
                title="Select a conversation"
                description="Choose a conversation from the list to view messages"
              />
            </div>
          )}
        </div>
      </div>

      {/* New Conversation Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="New Conversation"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client <span className="text-red-500">*</span>
            </label>
            <select
              value={newConversationClient}
              onChange={(e) => setNewConversationClient(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a client...</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.company_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newConversationSubject}
              onChange={(e) => setNewConversationSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter conversation subject..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowNewModal(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateConversation}
              disabled={creating || !newConversationClient || !newConversationSubject.trim()}
            >
              {creating ? "Creating..." : "Start Conversation"}
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
