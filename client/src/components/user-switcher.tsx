import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, RefreshCw, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface User {
  id: string;
  email?: string;
  firstName: string;
  lastName: string;
  roles: string;
}

const getRoleDisplayName = (roles: string) => {
  try {
    const roleArray = JSON.parse(roles);
    const roleMap: { [key: string]: string } = {
      handler: "担当者",
      approver: "承認者", 
      admin: "管理者"
    };
    return roleArray.map((role: string) => roleMap[role] || role).join(", ");
  } catch {
    return roles;
  }
};

const getRoleBadgeVariant = (roles: string) => {
  try {
    const roleArray = JSON.parse(roles);
    if (roleArray.includes('admin')) return 'destructive';
    if (roleArray.includes('approver')) return 'default';
    if (roleArray.includes('handler')) return 'secondary';
    return 'outline';
  } catch {
    return 'outline';
  }
};

export default function UserSwitcher() {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const { toast } = useToast();

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/logout");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "ログアウト完了",
        description: "正常にログアウトしました",
      });
      // Clear all cached data
      queryClient.clear();
      // Redirect to login page
      window.location.href = "/";
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: "ログアウトに失敗しました",
        variant: "destructive",
      });
    },
  });

  const switchUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("POST", "/api/switch-user", { userId });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "ユーザー切り替え完了",
        description: "ユーザーが正常に切り替わりました",
      });
      // Invalidate all queries to refresh user data
      queryClient.invalidateQueries();
      // Reload the page to reflect the user change
      window.location.reload();
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: "ユーザーの切り替えに失敗しました",
        variant: "destructive",
      });
    },
  });

  const handleSwitchUser = () => {
    if (selectedUserId) {
      switchUserMutation.mutate(selectedUserId);
    }
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const selectedUser = (users as User[]).find(u => u.id === selectedUserId);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          ユーザー切り替え（テスト用）
        </CardTitle>
        <CardDescription>
          開発・テスト用のユーザー切り替え機能です
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">切り替え先ユーザー</label>
          <Select value={selectedUserId} onValueChange={setSelectedUserId} data-testid="select-user">
            <SelectTrigger>
              <SelectValue placeholder="ユーザーを選択してください" />
            </SelectTrigger>
            <SelectContent>
              {(users as User[]).map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  <div className="flex items-center justify-between w-full">
                    <span>{user.lastName} {user.firstName}</span>
                    <Badge variant={getRoleBadgeVariant(user.roles)} className="ml-2">
                      {getRoleDisplayName(user.roles)}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedUser && (
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-sm space-y-1">
              <p><strong>名前:</strong> {selectedUser.lastName} {selectedUser.firstName}</p>
              {selectedUser.email && <p><strong>メール:</strong> {selectedUser.email}</p>}
              <p><strong>役割:</strong> <Badge variant={getRoleBadgeVariant(selectedUser.roles)}>
                {getRoleDisplayName(selectedUser.roles)}
              </Badge></p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Button 
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            className="w-full"
            variant="outline"
            data-testid="button-logout"
          >
            {logoutMutation.isPending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ログアウト中...
              </>
            ) : (
              <>
                <LogOut className="mr-2 h-4 w-4" />
                ログアウト
              </>
            )}
          </Button>

          <Button 
            onClick={handleSwitchUser}
            disabled={!selectedUserId || switchUserMutation.isPending}
            className="w-full"
            data-testid="button-switch-user"
          >
            {switchUserMutation.isPending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                切り替え中...
              </>
            ) : (
              "ユーザー切り替え"
            )}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          ※ この機能は開発・テスト用です。本番環境では無効化されます。
        </div>
      </CardContent>
    </Card>
  );
}