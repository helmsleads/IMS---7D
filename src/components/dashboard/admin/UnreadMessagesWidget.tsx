import Card from "@/components/ui/Card";
import Link from "next/link";
import { Mail } from "lucide-react";

interface Props {
  count: number;
  loading: boolean;
}

export default function UnreadMessagesWidget({ count, loading }: Props) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Messages</h3>
        <Link
          href="/messages"
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          View Inbox
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
          count > 0 ? "bg-blue-100" : "bg-slate-100"
        }`}>
          <Mail className={`w-6 h-6 ${
            count > 0 ? "text-blue-600" : "text-slate-400"
          }`} />
        </div>
        <div>
          <p className={`text-2xl font-semibold ${
            count > 0 ? "text-blue-600" : "text-slate-900"
          }`}>
            {loading ? "\u2014" : count}
          </p>
          <p className="text-sm text-slate-500">
            Unread {count === 1 ? "message" : "messages"}
          </p>
        </div>
      </div>
    </Card>
  );
}
