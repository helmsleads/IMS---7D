import Card from "@/components/ui/Card";
import Link from "next/link";
import { MessageSquare } from "lucide-react";

interface Props {
  unreadMessages: number;
}

export default function UnreadMessagesWidget({ unreadMessages }: Props) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${unreadMessages > 0 ? "bg-red-100" : "bg-slate-100"}`}>
            <MessageSquare className={`w-6 h-6 ${unreadMessages > 0 ? "text-red-600" : "text-slate-500"}`} />
          </div>
          <div>
            <p className="text-sm text-slate-500">Unread Messages</p>
            <p className={`text-2xl font-bold ${unreadMessages > 0 ? "text-red-600" : "text-slate-900"}`}>
              {unreadMessages}
            </p>
          </div>
        </div>
        <Link
          href="/portal/messages"
          className="text-sm text-cyan-600 hover:text-cyan-700 font-medium whitespace-nowrap"
        >
          View Messages
        </Link>
      </div>
    </Card>
  );
}
