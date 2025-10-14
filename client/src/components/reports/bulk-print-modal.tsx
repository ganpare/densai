import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { FileDown, Loader2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface BulkPrintModalProps {
  onClose: () => void;
}

interface TodayReportsResponse {
  success: boolean;
  reportCount: number;
  reportsByBank: Record<string, any[]>; // サーバは配列（各銀行のレポート配列）を返す
}

interface BulkPrintFile {
  filename: string;
  bankCode: string;
  reportCount: number;
}

interface BulkPrintResponse {
  success: boolean;
  message: string;
  files: BulkPrintFile[];
  totalReports: number;
}

const templateOptions = [
  { value: 'simple', label: 'シンプル形式', description: '基本的な表形式レイアウト' },
  { value: 'classic', label: 'クラシック形式', description: '従来型のレイアウト' },
  { value: 'modern', label: 'モダン形式', description: 'カード型のモダンデザイン' },
  { value: 'compact', label: 'コンパクト形式', description: '情報密度の高いレイアウト' },
  { value: 'original', label: '従来形式', description: '現在のテンプレート' },
];

export default function BulkPrintModal({ onClose, inline = false as any }: BulkPrintModalProps & { inline?: boolean }) {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState('simple');
  const [processingBankCode, setProcessingBankCode] = useState<string | null>(null);

  // Fetch today's approved reports
  const { data: todayData, isLoading, refetch } = useQuery<TodayReportsResponse>({
    queryKey: ["/api/reports/today-approved"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/reports/today-approved");
      return response.json();
    },
    retry: false,
  });

  // Bulk print mutation
  const bulkPrintMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/reports/bulk-pdf/generate", {
        template: selectedTemplate
      });
      const result = await response.json();
      return result;
    },
    onSuccess: (data: BulkPrintResponse) => {
      if (data.files && data.files.length > 0) {
        toast({
          title: "一括PDF生成完了",
          description: `${data.files.length}の金融機関、合計${data.totalReports}件の報告書のPDFを生成しました。`,
        });
        
        // 生成されたファイル情報を表示
        console.log("Generated files:", data.files);
        data.files.forEach(file => {
          console.log(`- ${file.filename}: 金融機関${file.bankCode} (${file.reportCount}件)`);
        });
        
        onClose();
      } else {
        toast({
          title: "生成対象なし",
          description: "本日承認済みの報告書はありません。",
        });
      }
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "PDF生成エラー",
        description: "一括PDF生成に失敗しました。",
        variant: "destructive",
      });
    },
  });

  const handleGenerateClick = () => {
    bulkPrintMutation.mutate();
  };

  const isLoadingData = isLoading || bulkPrintMutation.isPending;
  const hasReports = todayData?.reportCount && todayData.reportCount > 0;

  const content = (
    <div className="space-y-6">
      {!inline && (
        <>
          <h2 className="sr-only">一括PDF生成</h2>
          <p className="sr-only">今日承認済みの報告書を、金融機関別にまとめてPDF化します。テンプレートを選択してください。</p>
        </>
      )}
          {/* 今日の報告書状況 */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">今日の承認済み報告書</h3>
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">読み込み中...</span>
              </div>
            ) : hasReports ? (
              <div className="space-y-2">
                <div className="text-sm">
                  合計 <span className="font-bold">{todayData.reportCount}</span> 件の報告書
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(todayData.reportsByBank).map(([bankCode, list]) => {
                    const count = Array.isArray(list) ? list.length : (typeof list === 'number' ? list : 0);
                    return (
                      <div key={bankCode} className="flex justify-between text-sm border rounded p-2">
                        <span>金融機関 {bankCode}</span>
                        <span className="font-bold">{count}件</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                本日承認済みの報告書はありません。
              </div>
            )}
          </div>

          {/* テンプレート選択 */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">テンプレート選択</h3>
            <RadioGroup value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <div className="space-y-3">
                {templateOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-3">
                    <RadioGroupItem value={option.value} id={option.value} />
                    <Label htmlFor={option.value} className="flex-1 cursor-pointer">
                      <div className="font-medium">{option.label}</div>
                      <div className="text-sm text-muted-foreground">{option.description}</div>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>

          {/* 生成情報 */}
          {hasReports && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm text-blue-800">
                <div className="font-medium mb-1">生成されるPDFファイル:</div>
                <ul className="space-y-1">
                  {Object.entries(todayData.reportsByBank).map(([bankCode, list]) => {
                    const count = Array.isArray(list) ? list.length : (typeof list === 'number' ? list : 0);
                    return (
                      <li key={bankCode}>
                        • <span className="font-mono">{new Date().toISOString().slice(0, 10).replace(/-/g, '')}_{bankCode}.pdf</span>
                        <span className="text-blue-600"> ({count}件)</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}

          {/* 処理中表示 */}
          {processingBankCode && (
            <div className="flex items-center space-x-2 text-sm text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>金融機関 {processingBankCode} のPDFを生成中...</span>
            </div>
          )}

          {/* ボタン */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={isLoadingData}>
              キャンセル
            </Button>
            <Button 
              onClick={handleGenerateClick} 
              disabled={isLoadingData || !hasReports}
              className="flex items-center"
            >
              <FileDown className="mr-2 h-4 w-4" />
              {isLoadingData ? "生成中..." : "PDF生成"}
            </Button>
          </div>
    </div>
  );

  if (inline) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-4">
          <h1 className="text-xl font-semibold">一括PDF生成</h1>
          <p className="text-sm text-muted-foreground">今日承認済みの報告書を、金融機関別にまとめてPDF化します。テンプレートを選択してください。</p>
        </div>
        {content}
      </div>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>一括PDF生成</DialogTitle>
          <DialogDescription>
            今日承認済みの報告書を、金融機関別にまとめてPDF化します。テンプレートを選択してください。
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}