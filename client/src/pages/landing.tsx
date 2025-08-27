import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { File, CheckCircle, Clock, Shield } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <File className="h-12 w-12 text-primary mr-4" />
            <h1 className="text-4xl font-bold text-foreground">
              電子債権問い合わせ対応報告書システム
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            電子債権ネットワークの問い合わせ対応を効率的に管理し、
            日次報告書の作成から承認まで一元化されたワークフローを提供します。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <Card>
            <CardHeader>
              <File className="h-8 w-8 text-primary mb-2" />
              <CardTitle>報告書作成</CardTitle>
              <CardDescription>
                問い合わせ内容から対応結果まで、必要な情報を簡単に入力・管理
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CheckCircle className="h-8 w-8 text-success mb-2" />
              <CardTitle>承認フロー</CardTitle>
              <CardDescription>
                作成された報告書は承認者による確認を経て、正式な報告書として確定
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Shield className="h-8 w-8 text-warning mb-2" />
              <CardTitle>セキュア印刷</CardTitle>
              <CardDescription>
                承認済み報告書はPDF出力または指定プリンターでの印刷が可能
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div className="text-center">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>システムにログイン</CardTitle>
              <CardDescription>
                認証システムを通じてセキュアにアクセス
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleLogin} 
                className="w-full"
                data-testid="button-login"
              >
                ログイン
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-16 text-center text-sm text-muted-foreground">
          <p>
            本システムは金融機関の電子債権ネットワーク問い合わせ対応業務を支援します。
          </p>
        </div>
      </div>
    </div>
  );
}
