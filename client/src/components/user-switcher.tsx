import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  approvalLevel: number;
}

const getRoleDisplayName = (role: string) => {
  const roleMap: { [key: string]: string } = {
    creator: "作成者",
    approver: "承認者", 
    admin: "管理者"
  };
  return roleMap[role] || role;
};

const getRoleBadgeVariant = (role: string) => {
  switch (role) {
    case 'admin': return 'destructive';
    case 'approver': return 'default';
    case 'creator': return 'secondary';
    default: return 'outline';
  }
};

export default function UserSwitcher() {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const { toast } = useToast();

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    retry: false,
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
                    <Badge variant={getRoleBadgeVariant(user.role)} className="ml-2">
                      {getRoleDisplayName(user.role)}
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
              <p><strong>メール:</strong> {selectedUser.email}</p>
              <p><strong>役割:</strong> <Badge variant={getRoleBadgeVariant(selectedUser.role)}>
                {getRoleDisplayName(selectedUser.role)}
              </Badge></p>
              <p><strong>承認レベル:</strong> レベル{selectedUser.approvalLevel}</p>
            </div>
          </div>
        )}

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

        <div className="text-xs text-muted-foreground">
          ※ この機能は開発・テスト用です。本番環境では無効化されます。
        </div>
      </CardContent>
    </Card>
  );
}