import { redirect } from "next/navigation";
import Nav from "@/components/nav";
import { DemoModeProvider } from "@/lib/demo-context";
import { createClient } from "@/lib/supabase/server";
import { initials } from "@/lib/utils";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [
    { data: profile },
    { count: linesCount },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    supabase.from("production_lines").select("*", { count: "exact", head: true }),
  ]);

  const userName    = profile?.full_name ?? user.email ?? "User";
  const userInitials = initials(userName);
  const defaultIsDemo = (linesCount ?? 0) === 0;

  return (
    <DemoModeProvider defaultIsDemo={defaultIsDemo}>
      <div className="dash min-h-screen flex flex-col" style={{ backgroundColor: "#0f0f0e", color: "#f0ede8" }}>
        <Nav userName={userName} userInitials={userInitials} />
        <main className="flex-1">{children}</main>
      </div>
    </DemoModeProvider>
  );
}
