import { checkAdmin } from "@/lib/admin";
import { NotchNav } from "@/components/ui/notch-nav";

type NavIcon = "home";

type NavItem = {
  value: string;
  label: string;
  href: string;
  icon: NavIcon;
  adminOnly?: boolean;
};

const allNavItems: NavItem[] = [
  { value: "home", label: "Home", href: "/", icon: "home" },
  { value: "dashboard", label: "Dashboard", href: "/dashboard", icon: "home", adminOnly: true },
  { value: "upload", label: "Upload", href: "/upload", icon: "home", adminOnly: true },
];

export async function NavWrapper() {
  const isAdmin = await checkAdmin();
  const navItems = allNavItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <NotchNav
      items={navItems}
      defaultValue="home"
      ariaLabel="Primary navigation"
    />
  );
}
