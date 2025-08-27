import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Lock, Bell, Shield, Database, AlertCircle, CheckCircle, Cog } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// プロファイル更新スキーマ
const profileSchema = z.object({
  firstName: z.string().min(1, "名前を入力してください"),
  lastName: z.string().min(1, "姓を入力してください"),
  email: z.string().email("有効なメールアドレスを入力してください").optional(),
});

// パスワード変更スキーマ
const passwordSchema = z.object({
  currentPassword: z.string().min(1, "現在のパスワードを入力してください"),
  newPassword: z.string().min(6, "新しいパスワードは6文字以上で入力してください"),
  confirmPassword: z.string().min(1, "パスワード確認を入力してください"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "パスワードが一致しません",
  path: ["confirmPassword"],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export default function Settings() {
  const [activeTab, setActiveTab] = useState("profile");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ユーザー情報取得
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  // プロファイル更新フォーム
  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: (user as any)?.firstName || "",
      lastName: (user as any)?.lastName || "",
      email: (user as any)?.email || "",
    },
  });

  // パスワード変更フォーム
  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // プロファイル更新ミューテーション
  const profileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const response = await apiRequest("PUT", `/api/users/${(user as any)?.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "プロファイル更新完了",
        description: "プロファイルが正常に更新されました",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: any) => {
      toast({
        title: "更新エラー",
        description: "プロファイルの更新に失敗しました",
        variant: "destructive",
      });
    },
  });

  // パスワード変更ミューテーション
  const passwordMutation = useMutation({
    mutationFn: async (data: PasswordFormData) => {
      const response = await apiRequest("POST", "/api/auth/change-password", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "パスワード変更完了",
        description: "パスワードが正常に変更されました",
      });
      passwordForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "変更エラー",
        description: "パスワードの変更に失敗しました",
        variant: "destructive",
      });
    },
  });

  const onProfileSubmit = (data: ProfileFormData) => {
    profileMutation.mutate(data);
  };

  const onPasswordSubmit = (data: PasswordFormData) => {
    passwordMutation.mutate(data);
  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <Cog className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">設定</h1>
        </div>
        <p className="text-muted-foreground">
          アカウント設定とシステム設定を管理
        </p>
      </div>

      <Separator />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            プロファイル
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            セキュリティ
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            通知
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            システム
          </TabsTrigger>
        </TabsList>

        {/* プロファイル設定 */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                プロファイル情報
              </CardTitle>
              <CardDescription>
                ユーザー情報を編集できます
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={profileForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>姓</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="田中"
                              data-testid="input-last-name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>名</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="太郎"
                              data-testid="input-first-name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={profileForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>メールアドレス</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="example@company.com"
                            data-testid="input-email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={profileMutation.isPending}
                      data-testid="button-save-profile"
                    >
                      {profileMutation.isPending ? "更新中..." : "プロファイルを更新"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* 役割と権限情報 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                役割と権限
              </CardTitle>
              <CardDescription>
                現在の役割と承認レベル（管理者のみ変更可能）
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>役割</Label>
                  <div className="mt-1 p-2 bg-muted rounded-md">
                    {(user as any)?.role === 'creator' && '作成者'}
                    {(user as any)?.role === 'approver' && '承認者'}
                    {(user as any)?.role === 'admin' && '管理者'}
                  </div>
                </div>
                <div>
                  <Label>承認レベル</Label>
                  <div className="mt-1 p-2 bg-muted rounded-md">
                    レベル {(user as any)?.approvalLevel}
                  </div>
                </div>
              </div>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  役割と承認レベルの変更は管理者に依頼してください。
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* セキュリティ設定 */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                パスワード変更
              </CardTitle>
              <CardDescription>
                アカウントのセキュリティを保つため定期的にパスワードを変更してください
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                  <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>現在のパスワード</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="現在のパスワードを入力"
                            data-testid="input-current-password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>新しいパスワード</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="新しいパスワードを入力"
                            data-testid="input-new-password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>パスワード確認</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="新しいパスワードを再入力"
                            data-testid="input-confirm-password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={passwordMutation.isPending}
                      data-testid="button-change-password"
                    >
                      {passwordMutation.isPending ? "変更中..." : "パスワードを変更"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 通知設定 */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                通知設定
              </CardTitle>
              <CardDescription>
                システム通知とメール通知の設定
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>承認依頼通知</Label>
                    <p className="text-sm text-muted-foreground">
                      新しい承認依頼があった時に通知を受け取る
                    </p>
                  </div>
                  <Switch defaultChecked data-testid="switch-approval-notifications" />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>ステータス更新通知</Label>
                    <p className="text-sm text-muted-foreground">
                      報告書のステータスが変更された時に通知を受け取る
                    </p>
                  </div>
                  <Switch defaultChecked data-testid="switch-status-notifications" />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>メール通知</Label>
                    <p className="text-sm text-muted-foreground">
                      重要な更新をメールで受け取る
                    </p>
                  </div>
                  <Switch data-testid="switch-email-notifications" />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>通知頻度</Label>
                  <Select defaultValue="immediate">
                    <SelectTrigger data-testid="select-notification-frequency">
                      <SelectValue placeholder="通知頻度を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">即座に通知</SelectItem>
                      <SelectItem value="hourly">1時間ごと</SelectItem>
                      <SelectItem value="daily">1日1回</SelectItem>
                      <SelectItem value="weekly">週1回</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* システム設定 */}
        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                システム情報
              </CardTitle>
              <CardDescription>
                システムの状態と設定情報
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>ユーザーID</Label>
                  <div className="mt-1 p-2 bg-muted rounded-md font-mono text-sm">
                    {(user as any)?.username}
                  </div>
                </div>
                <div>
                  <Label>登録日</Label>
                  <div className="mt-1 p-2 bg-muted rounded-md text-sm">
                    {(user as any)?.createdAt ? new Date((user as any).createdAt * 1000).toLocaleDateString('ja-JP') : '-'}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>システム状態</Label>
                <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-md">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-800 dark:text-green-200">
                    システムは正常に動作しています
                  </span>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>データベース設定</Label>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>• SQLiteデータベース使用</p>
                  <p>• オフライン環境対応</p>
                  <p>• セッション管理有効</p>
                  <p>• バックアップ機能準備中</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 管理者専用設定 */}
          {(user as any)?.role === 'admin' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  管理者設定
                </CardTitle>
                <CardDescription>
                  システム管理者専用の設定項目
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>デバッグモード</Label>
                    <p className="text-sm text-muted-foreground">
                      システムのデバッグ情報を表示
                    </p>
                  </div>
                  <Switch data-testid="switch-debug-mode" />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>メンテナンスモード</Label>
                    <p className="text-sm text-muted-foreground">
                      一般ユーザーのアクセスを制限
                    </p>
                  </div>
                  <Switch data-testid="switch-maintenance-mode" />
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button variant="outline" data-testid="button-backup-data">
                    データバックアップ
                  </Button>
                  <Button variant="outline" data-testid="button-system-logs">
                    システムログ確認
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}