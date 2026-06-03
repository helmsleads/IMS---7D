"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
  UserPlus,
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
  addWarehouseManagerToConversation,
  getWarehouseUsers,
  ConversationWithMessages,
} from "@/lib/api/messages";
import type { ConversationParticipant } from "@/types/database";
import { getClients, Client } from "@/lib/api/clients";
import { Message, ConversationStatus } from "@/types/database";
import { createClient } from "@/lib/supabase";
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
  const { staffUser } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (staffUser?.role === "warehouse") {
      setParticipatingOnly(true);
    }
  }, [staffUser?.role]);

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
  const [myClientsOnly, setMyClientsOnly] = useState(false);
  const [participatingOnly, setParticipatingOnly] = useState(false);

  // Add warehouse manager
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
  const [warehouseUsers, setWarehouseUsers] = useState<
    { id: string; name: string; email: string | null }[]
  >([]);
  const [selectedWarehouseUserId, setSelectedWarehouseUserId] = useState("");
  const [addingParticipant, setAddingParticipant] = useState(false);

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

  const markClientMessagesReadLocally = (
    msgs: Message[],
    readAt: string
  ): Message[] =>
    msgs.map((m) =>
      m.sender_type === "client" && !m.read_at ? { ...m, read_at: readAt } : m
    );

  const applyConversationReadLocally = (conversationId: string, readAt: string) => {
    setMessages((prev) => markClientMessagesReadLocally(prev, readAt));
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? { ...c, messages: markClientMessagesReadLocally(c.messages, readAt) }
          : c
      )
    );
  };

  const fetchMessages = async (conversationId: string) => {
    setLoadingMessages(true);
    const readAt = new Date().toISOString();
    try {
      const messagesData = await getMessages(conversationId);
      setMessages(messagesData);
      await markAllRead(conversationId);
      applyConversationReadLocally(conversationId, readAt);
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

  // Real-time subscription for new messages in the selected conversation
  useEffect(() => {
    if (!selectedConversation) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${selectedConversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedConversation.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          // Only add if it's not from us (our messages are already added optimistically)
          if (newMsg.sender_type !== "user") {
            setMessages((prev) => {
              // Deduplicate
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            // Mark as read since we're viewing
            markAllRead(selectedConversation.id)
              .then((cleared) => {
                if (cleared > 0) {
                  applyConversationReadLocally(
                    selectedConversation.id,
                    new Date().toISOString()
                  );
                }
              })
              .catch((err) => console.error("Failed to mark messages read:", err));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedConversation.id}`,
        },
        (payload) => {
          const updated = payload.new as Message;
          // Update read_at status on our messages (client read our message)
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, read_at: updated.read_at } : m))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation?.id]);

  // Real-time subscription for conversation list updates (new messages in any conversation)
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("messages:all")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => {
          // Refresh conversation list to update unread counts and previews
          getConversations({ status: statusFilter || undefined })
            .then(setConversations)
            .catch(() => {});
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [statusFilter]);

  const filteredConversations = useMemo(() => {
    let list = conversations;

    if (myClientsOnly && staffUser) {
      list = list.filter(
        (c) => c.client?.account_manager_id === staffUser.id
      );
    }

    if (participatingOnly && staffUser) {
      list = list.filter((c) =>
        c.participants?.some((p) => p.user_id === staffUser.id)
      );
    }

    if (!searchTerm) return list;
    const search = searchTerm.toLowerCase();
    return list.filter(
      (c) =>
        c.subject.toLowerCase().includes(search) ||
        c.client?.company_name.toLowerCase().includes(search) ||
        c.client?.account_manager?.name?.toLowerCase().includes(search)
    );
  }, [conversations, searchTerm, myClientsOnly, participatingOnly, staffUser]);

  const staffNameById = useMemo(() => {
    const map = new Map<string, string>();
    if (staffUser) {
      map.set(staffUser.id, staffUser.name);
    }
    selectedConversation?.participants?.forEach((p) => {
      if (p.user?.name) map.set(p.user_id, p.user.name);
    });
    return map;
  }, [selectedConversation?.participants, staffUser]);

  const canAddWarehouseManager =
    !!selectedConversation &&
    !!staffUser &&
    selectedConversation.status === "open" &&
    (staffUser.role === "admin" ||
      selectedConversation.client?.account_manager_id === staffUser.id);

  const warehouseManagersOnThread = useMemo(
    () =>
      selectedConversation?.participants?.filter(
        (p) => p.participant_role === "warehouse_manager"
      ) || [],
    [selectedConversation?.participants]
  );

  const openAddParticipantModal = async () => {
    setShowAddParticipantModal(true);
    setSelectedWarehouseUserId("");
    try {
      const users = await getWarehouseUsers();
      const onThread = new Set(
        selectedConversation?.participants?.map((p) => p.user_id) || []
      );
      setWarehouseUsers(users.filter((u) => !onThread.has(u.id)));
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const handleAddWarehouseManager = async () => {
    if (!selectedConversation || !selectedWarehouseUserId) return;

    setAddingParticipant(true);
    setError(null);
    try {
      const participant = await addWarehouseManagerToConversation(
        selectedConversation.id,
        selectedWarehouseUserId
      );

      const updatedParticipants = [
        ...(selectedConversation.participants || []),
        participant,
      ];

      setSelectedConversation({
        ...selectedConversation,
        participants: updatedParticipants,
      });

      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConversation.id
            ? { ...c, participants: updatedParticipants }
            : c
        )
      );

      const messagesData = await getMessages(selectedConversation.id);
      setMessages(messagesData);

      setShowAddParticipantModal(false);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setAddingParticipant(false);
    }
  };

  const participantLabel = (p: ConversationParticipant) => {
    const name = p.user?.name || "Unknown";
    if (p.participant_role === "account_manager") return `${name} (Account Manager)`;
    if (p.participant_role === "warehouse_manager") return `${name} (Warehouse)`;
    return name;
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !staffUser) return;

    const messageContent = newMessage.trim();
    const now = new Date().toISOString();

    // Create optimistic message
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: selectedConversation.id,
      sender_type: "user",
      sender_id: staffUser.id,
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
        staffUser.id
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
      setSelectedConversation({ ...selectedConversation, status: "closed" });
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConversation.id ? { ...c, status: "closed" } : c
        )
      );
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const handleReopenConversation = async () => {
    if (!selectedConversation) return;

    try {
      await updateConversation(selectedConversation.id, { status: "open" });
      setSelectedConversation({ ...selectedConversation, status: "open" });
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConversation.id ? { ...c, status: "open" } : c
        )
      );
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
      <AppShell title="Messages" subtitle="Client messages — reply in-platform">
        <FetchError message={error} onRetry={fetchConversations} />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Messages"
      subtitle="Client messages — reply in-platform (no personal numbers)"
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
            <div className="flex gap-1 flex-wrap">
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
            {staffUser && (
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={myClientsOnly}
                    onChange={(e) => {
                      setMyClientsOnly(e.target.checked);
                      if (e.target.checked) setParticipatingOnly(false);
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  My clients only
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={participatingOnly}
                    onChange={(e) => {
                      setParticipatingOnly(e.target.checked);
                      if (e.target.checked) setMyClientsOnly(false);
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Participating in
                </label>
              </div>
            )}
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
                        {conversation.client?.account_manager?.name && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">
                            AM: {conversation.client.account_manager.name}
                          </p>
                        )}
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
                    {selectedConversation.participants &&
                      selectedConversation.participants.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {selectedConversation.participants.map((p) => (
                            <span
                              key={p.id}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700"
                            >
                              {participantLabel(p)}
                            </span>
                          ))}
                        </div>
                      )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {canAddWarehouseManager && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={openAddParticipantModal}
                      >
                        <UserPlus className="w-4 h-4 mr-1" />
                        Add warehouse manager
                      </Button>
                    )}
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
                      const isSystemNote =
                        isStaff &&
                        message.content.includes("added ") &&
                        message.content.includes(" to this conversation");
                      const staffLabel =
                        message.sender_id === staffUser?.id
                          ? "You"
                          : staffNameById.get(message.sender_id) || "7 Degrees Team";
                      return (
                        <div
                          key={message.id}
                          className={`flex ${
                            isSystemNote
                              ? "justify-center"
                              : isStaff
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[70%] ${
                              isSystemNote
                                ? "max-w-full"
                                : isStaff
                                ? "items-end"
                                : "items-start"
                            }`}
                          >
                            {/* Sender Name */}
                            {!isSystemNote && (
                              <p
                                className={`text-xs font-medium mb-1 ${
                                  isStaff ? "text-right text-blue-600" : "text-gray-600"
                                }`}
                              >
                                {isStaff
                                  ? staffLabel
                                  : selectedConversation.client?.company_name}
                              </p>
                            )}
                            {/* Message Bubble */}
                            <div
                              className={`rounded-lg p-3 shadow-sm ${
                                isSystemNote
                                  ? "bg-gray-200 text-gray-600 text-center text-xs italic"
                                  : isStaff
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

      {/* Add warehouse manager modal */}
      <Modal
        isOpen={showAddParticipantModal}
        onClose={() => setShowAddParticipantModal(false)}
        title="Add warehouse manager"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Loop in a warehouse manager to help with this conversation. They will
            be able to read the thread and reply in the portal.
          </p>
          {warehouseManagersOnThread.length > 0 && (
            <p className="text-xs text-gray-500">
              Already on thread:{" "}
              {warehouseManagersOnThread
                .map((p) => p.user?.name || "Unknown")
                .join(", ")}
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Warehouse manager <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedWarehouseUserId}
              onChange={(e) => setSelectedWarehouseUserId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a warehouse manager...</option>
              {warehouseUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.email ? ` (${u.email})` : ""}
                </option>
              ))}
            </select>
            {warehouseUsers.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                No warehouse users available. Add staff with the warehouse role in
                Settings → System.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => setShowAddParticipantModal(false)}
              disabled={addingParticipant}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddWarehouseManager}
              disabled={addingParticipant || !selectedWarehouseUserId}
            >
              {addingParticipant ? "Adding..." : "Add to conversation"}
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
