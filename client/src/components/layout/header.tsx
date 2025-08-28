import { useEffect, useState } from "react";
import { Bell, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6" data-testid="header">
      <div className="flex items-center space-x-4">
        <h2 className="text-xl font-semibold" data-testid="text-page-title">
          {title}
        </h2>
      </div>
      <div className="flex items-center space-x-4">
        <div className="text-sm text-muted-foreground">
          <span data-testid="text-current-date">{formatDate(currentTime)}</span>
          <span className="mx-2">|</span>
          <span data-testid="text-current-time">{formatTime(currentTime)}</span>
        </div>
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-1" data-testid="button-home">
            <Home className="h-4 w-4" />
            ダッシュボード
          </Button>
        </Link>
        <Button variant="ghost" size="sm" className="relative" data-testid="button-notifications">
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
