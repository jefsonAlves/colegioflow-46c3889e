import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Loading } from "@/components/States";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { loading, firebaseUser, userDoc } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      navigate({ to: "/login" });
      return;
    }
    if (userDoc && !userDoc.onboardingComplete) {
      navigate({ to: "/onboarding" });
    }
  }, [loading, firebaseUser, userDoc, navigate]);

  if (loading || !firebaseUser || !userDoc) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  return <Outlet />;
}
