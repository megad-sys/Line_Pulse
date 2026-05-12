import { redirect } from "next/navigation";
import Nav from "@/components/nav";
import { DemoModeProvider } from "@/lib/demo-context";
import { ToastProvider } from "@/components/toast-provider";
import { ThemeProvider } from "@/lib/theme-context";
import { createClient } from "@/lib/supabase/server";
import { initials } from "@/lib/utils";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();

  const userName     = profile?.full_name ?? user.email ?? "User";
  const userEmail    = user.email ?? "";
  const userInitials = initials(userName);

  return (
    <ThemeProvider>
      <DemoModeProvider>
        <ToastProvider>
          <div className="dash min-h-screen flex flex-col" style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}>
            <Nav userName={userName} userEmail={userEmail} userInitials={userInitials} />
            <main className="flex-1">{children}</main>
          </div>
        </ToastProvider>
      </DemoModeProvider>
    </ThemeProvider>
  );
}
