import type { Metadata } from "next";
import { cookies } from "next/headers";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider, type Theme } from "@/components/theme";
import { NotchNav } from "@/components/ui/notch-nav";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";

type NavIcon = "home";

const navItems: Array<{
  value: string;
  label: string;
  href: string;
  icon: NavIcon;
}> = [
  { value: "home", label: "Home", href: "/", icon: "home" },
  { value: "dashboard", label: "Dashboard", href: "/dashboard", icon: "home" },
  { value: "upload", label: "Upload", href: "/upload", icon: "home" },
];

export const metadata: Metadata = {
  title: "Nawakes Review",
  description: "",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the theme from the cookie so the correct class is server-rendered —
  // no flash, and no client-side <script> (which React 19 warns about).
  const theme: Theme =
    (await cookies()).get("theme")?.value === "dark" ? "dark" : "light";

  return (
    <html
      lang="en"
      suppressHydrationWarning
      style={{ colorScheme: theme }}
      className={`${GeistSans.variable} ${GeistMono.variable} ${
        theme === "dark" ? "dark" : ""
      } h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-background text-foreground"
      >
        <ClerkProvider>
          <ThemeProvider initialTheme={theme}>
            <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur">
              <div className="mx-auto w-full max-w-7xl">
                <NotchNav
                  items={navItems}
                  defaultValue="home"
                  ariaLabel="Primary navigation"
                />
              </div>
            </header>
            <main className="flex-1 overflow-x-auto">
              {children}
              <Toaster position="top-right" />
            </main>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
