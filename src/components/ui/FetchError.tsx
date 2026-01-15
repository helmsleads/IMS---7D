"use client";

import { AlertCircle, RefreshCw } from "lucide-react";

interface FetchErrorProps {
  message?: string;
  onRetry?: () => void;
}

export default function FetchError({
  message = "Failed to load data. Please try again.",
  onRetry,
}: FetchErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
        <AlertCircle className="w-6 h-6 text-red-600" />
      </div>
      <p className="text-gray-900 font-medium text-center mb-2">
        Something went wrong
      </p>
      <p className="text-gray-500 text-sm text-center max-w-md mb-4">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      )}
    </div>
  );
}
