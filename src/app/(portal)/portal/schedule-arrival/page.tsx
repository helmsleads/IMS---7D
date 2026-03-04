"use client";

import { useRouter } from "next/navigation";
import ScheduleArrivalForm from "@/components/portal/ScheduleArrivalForm";

export default function ScheduleArrivalPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Schedule Arrival</h1>
        <p className="text-slate-500 mt-1">
          Notify the warehouse of an incoming delivery
        </p>
      </div>
      <ScheduleArrivalForm
        onSuccess={() => router.push("/portal/arrivals")}
      />
    </div>
  );
}
