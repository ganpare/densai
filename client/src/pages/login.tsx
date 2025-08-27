import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { File, LogIn, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const loginSchema = z.object({
  username: z.string().min(1, "ユーザーIDを入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError("");
    
    try {
      await apiRequest("POST", "/api/auth/login", data);
      toast({
        title: "ログイン成功",
        description: "システムにログインしました",
      });
      // ページをリロードして認証状態を更新
      window.location.href = "/";
    } catch (err: any) {
      setError("ユーザーIDまたはパスワードが正しくありません");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <File className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            電子債権問い合わせ対応報告書システム
          </h1>
          <p className="text-muted-foreground">
            ユーザーIDとパスワードでログインしてください
          </p>
        </div>

        {/* Login Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5" />
              ログイン
            </CardTitle>
            <CardDescription>
              認証情報を入力してシステムにアクセス
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ユーザーID</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="ユーザーIDを入力"
                          data-testid="input-username"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>パスワード</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="パスワードを入力"
                          data-testid="input-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  data-testid="button-login"
                >
                  {isLoading ? "ログイン中..." : "ログイン"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Sample Users Info */}
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-sm">テスト用アカウント</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-medium">作成者</p>
                <p className="text-muted-foreground">ID: tanaka</p>
                <p className="text-muted-foreground">ID: sato</p>
              </div>
              <div>
                <p className="font-medium">承認者</p>
                <p className="text-muted-foreground">ID: suzuki</p>
                <p className="text-muted-foreground">ID: takahashi</p>
              </div>
            </div>
            <div>
              <p className="font-medium">管理者</p>
              <p className="text-muted-foreground">ID: tamura</p>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              すべてのパスワード: password123
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}