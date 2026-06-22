import { Search, User, LogOut, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useSearch } from "@/contexts/SearchContext";
import { useLocation, useNavigate } from "react-router-dom";
import { NotificationCenter } from "./NotificationCenter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface TopNavbarProps {
  title: string;
}

export function TopNavbar({ title }: TopNavbarProps) {
  const { username, role, logout } = useAuth();
  const { searchQuery, setSearchQuery } = useSearch();
  const location = useLocation();
  const navigate = useNavigate();

  // Determine placeholder based on current page
  const getSearchPlaceholder = () => {
    const path = location.pathname;
    if (path.includes("consumers")) return "Search consumers...";
    if (path.includes("billing")) return "Search bills...";
    if (path.includes("readings")) return "Search readings...";
    return "Search...";
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center border border-border bg-white md:hidden p-1">
           <img src="/assets/logo.png" alt="Logo" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={getSearchPlaceholder()}
            className="pl-9 w-64 h-9 bg-muted/50 border-border/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <NotificationCenter />

        <div className="h-8 w-px bg-border mx-2 hidden sm:block" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-3 px-2 hover:bg-muted/50">
              <Avatar className="h-8 w-8 border border-border">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold uppercase">
                  {username?.substring(0, 2) || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-foreground leading-none">{username || "User"}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mt-1">{role || "—"}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2" onClick={() => navigate("/settings")}>
              <Settings className="w-4 h-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={handleLogout}>
              <LogOut className="w-4 h-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
