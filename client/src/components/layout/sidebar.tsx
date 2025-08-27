import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  File, 
  LayoutDashboard, 
  FileText, 
  CheckCircle, 
  History, 
  Settings, 
  LogOut, 
  Menu, 
  X 
} from "lucide-react";

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const { data: statistics } = useQuery({
    queryKey: ["/api/statistics"],
    retry: false,
  });

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const navigation = [
    {
      name: "ダッシュボード",
      href: "/",
      icon: LayoutDashboard,
      current: location === "/",
    },
    {
      name: "報告書作成",
      href: "/reports/new",
      icon: FileText,
      current: location.startsWith("/reports"),
    },
    {
      name: "承認待ち",
      href: "/approval",
      icon: CheckCircle,
      current: location === "/approval",
      badge: (statistics as any)?.pendingApprovals || 0,
      show: (user as any)?.role === "approver" || (user as any)?.role === "admin",
    },
    {
      name: "履歴・検索",
      href: "/history", 
      icon: History,
      current: location === "/history",
    },
    {
      name: "設定",
      href: "/settings",
      icon: Settings,
      current: location === "/settings",
    },
  ];

  const filteredNavigation = navigation.filter(item => item.show !== false);

  const getUserInitials = (user: any) => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`;
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  const getUserDisplayName = (user: any) => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user?.email) {
      return user.email;
    }
    return "ユーザー";
  };

  const getRoleDisplayName = (role: string) => {
    const roleMap = {
      creator: "作成者",
      approver: "承認者", 
      admin: "管理者",
    };
    return roleMap[role as keyof typeof roleMap] || role;
  };

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          data-testid="button-mobile-menu"
        >
          {isMobileOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Sidebar */}
      <div 
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border transform transition-transform duration-200",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0"
        )}
        data-testid="sidebar"
      >
        <div className="flex flex-col h-full">
          {/* Logo and Title */}
          <div className="flex items-center justify-center h-16 px-4 border-b border-border">
            <div className="flex items-center space-x-2">
              <File className="text-primary text-xl" />
              <h1 className="text-lg font-semibold text-foreground">電債報告書システム</h1>
            </div>
          </div>
          
          {/* Navigation Menu */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {filteredNavigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors",
                    item.current
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                  data-testid={`nav-${item.href.replace(/[\/]/g, '-') || 'home'}`}
                  onClick={() => setIsMobileOpen(false)}
                >
                  <Icon className="mr-3 h-4 w-4" />
                  {item.name}
                  {item.badge !== undefined && item.badge > 0 && (
                    <Badge 
                      variant="secondary" 
                      className="ml-auto bg-warning/10 text-warning"
                      data-testid={`badge-${item.href.replace(/[\/]/g, '-') || 'home'}`}
                    >
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>
          
          {/* User Info */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                <span className="text-sm font-medium" data-testid="text-user-initials">
                  {getUserInitials(user)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" data-testid="text-user-name">
                  {getUserDisplayName(user)}
                </p>
                <p className="text-xs text-muted-foreground" data-testid="text-user-role">
                  {(user as any)?.role ? getRoleDisplayName((user as any).role) : ""}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground"
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-30 bg-black bg-opacity-50" 
          onClick={() => setIsMobileOpen(false)}
        />
      )}
    </>
  );
}
