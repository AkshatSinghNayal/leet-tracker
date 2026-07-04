"use client";

import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AuthScreen } from "@/components/leet/AuthScreen";
import { Dashboard } from "@/components/leet/Dashboard";

function Gate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <AuthScreen />;
  return <Dashboard />;
}

export default function Home() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
