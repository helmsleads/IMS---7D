import { AuthProvider } from "@/lib/auth-context";
import ProtectedRoute from "@/components/internal/ProtectedRoute";

export default function InternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <ProtectedRoute>{children}</ProtectedRoute>
    </AuthProvider>
  );
}
