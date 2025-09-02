import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { X, Calendar, FileText, Printer, Download, Building, Clock } from "lucide-react";
import jsPDF from 'jspdf';

interface BulkPrintModalProps {
  onClose: () => void;
}

interface TodayReportsResponse {
  success: boolean;
  reportCount: number;
  reportsByBank: { [bankCode: string]: any[] };
  message: string;
}

interface BulkPrintFile {
  bankCode: string;
  reportCount: number;
  filename: string;
  htmlContent: string;
}

interface BulkPrintResponse {
  success: boolean;
  message: string;
  files: BulkPrintFile[];
  totalReports: number;
}

export default function BulkPrintModal({ onClose }: BulkPrintModalProps) {
  const { toast } = useToast();
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
      const response = await apiRequest("POST", "/api/reports/bulk-print-today", {});
      const result = await response.json();
      return result;
    },
    onSuccess: async (data: BulkPrintResponse) => {
      if (data.files && data.files.length > 0) {
        // Process each bank's PDF
        for (const file of data.files) {
          setProcessingBankCode(file.bankCode);
          await generateAndDownloadPDF(file);
          // Small delay between downloads
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        setProcessingBankCode(null);
        
        toast({
          title: "一括印刷完了",
          description: `${data.files.length}の金融機関、合計${data.totalReports}件の報告書を印刷しました。`,
        });
      } else {
        toast({
          title: "印刷対象なし",
          description: "本日承認済みの報告書はありません。",
        });
      }
    },
    onError: (error: Error) => {
      setProcessingBankCode(null);
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
        title: "一括印刷エラー",
        description: "一括印刷に失敗しました。",
        variant: "destructive",
      });
    },
  });

  // Convert HTML to PDF and trigger download
  const generateAndDownloadPDF = async (file: BulkPrintFile) => {
    try {
      // Create a temporary div to render HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = file.htmlContent;
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = '210mm'; // A4 width
      document.body.appendChild(tempDiv);

      // Create PDF using jsPDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Get text content and create PDF
      const content = tempDiv.textContent || '';
      const lines = pdf.splitTextToSize(content, 180);
      
      let yPos = 20;
      lines.forEach((line: string) => {
        if (yPos > 280) { // New page if near bottom
          pdf.addPage();
          yPos = 20;
        }
        pdf.text(line, 15, yPos);
        yPos += 7;
      });

      // Clean up
      document.body.removeChild(tempDiv);

      // Download PDF
      pdf.save(file.filename);

    } catch (error) {
      console.error('PDF generation error for bank', file.bankCode, ':', error);
      toast({
        title: "PDF生成エラー",
        description: `金融機関コード ${file.bankCode} のPDF生成に失敗しました。`,
        variant: "destructive",
      });
    }
  };

  const handleBulkPrint = () => {
    bulkPrintMutation.mutate();
  };

  const handleRefresh = () => {
    refetch();
  };

  const todayDate = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const isProcessing = isLoading || bulkPrintMutation.isPending;
  const reportsByBank = todayData?.reportsByBank || {};
  const bankCodes = Object.keys(reportsByBank);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto" data-testid="dialog-bulk-print">
        <DialogHeader className="border-b border-border pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center">
              <Calendar className="mr-2 h-5 w-5" />
              当日報告書 一括印刷
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isProcessing}
              data-testid="button-close-bulk-print"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Header Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">対象日:</span>
                <span className="font-medium">{todayDate}</span>
              </div>
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">承認済み報告書:</span>
                <Badge variant="secondary">
                  {todayData?.reportCount || 0}件
                </Badge>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isProcessing}
              data-testid="button-refresh-today"
            >
              更新
            </Button>
          </div>

          {/* Loading State */}
          {isProcessing && !processingBankCode && (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <div className="text-muted-foreground">データを読み込み中...</div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* No Reports */}
          {!isProcessing && bankCodes.length === 0 && (
            <Card>
              <CardContent className="py-8">
                <div className="text-center text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <div className="text-lg font-medium mb-2">本日承認済みの報告書はありません</div>
                  <div className="text-sm">報告書が承認されると、こちらに表示されます。</div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Banks List */}
          {!isProcessing && bankCodes.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">金融機関別報告書</h3>
                <Button
                  onClick={handleBulkPrint}
                  disabled={bulkPrintMutation.isPending}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  data-testid="button-start-bulk-print"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {bulkPrintMutation.isPending ? "印刷中..." : "一括印刷実行"}
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {bankCodes.map((bankCode) => {
                  const reports = reportsByBank[bankCode];
                  const isProcessing = processingBankCode === bankCode;

                  return (
                    <Card key={bankCode} className={`${isProcessing ? 'ring-2 ring-primary' : ''}`}>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center justify-between text-base">
                          <div className="flex items-center space-x-2">
                            <Building className="h-4 w-4" />
                            <span>金融機関: {bankCode}</span>
                          </div>
                          {isProcessing && (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">報告書件数:</span>
                            <Badge variant="outline">{reports.length}件</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {reports.slice(0, 3).map((report: any, index: number) => (
                              <div key={index} className="truncate">
                                • {report.reportNumber} - {report.companyName}
                              </div>
                            ))}
                            {reports.length > 3 && (
                              <div className="text-center pt-1">
                                ... 他{reports.length - 3}件
                              </div>
                            )}
                          </div>
                          {isProcessing && (
                            <div className="text-xs text-primary font-medium text-center pt-2">
                              PDF生成中...
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Processing Status */}
          {processingBankCode && (
            <Card className="border-primary">
              <CardContent className="py-4">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <div>
                    <div className="font-medium">PDF生成中...</div>
                    <div className="text-sm text-muted-foreground">
                      金融機関コード: {processingBankCode}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Instructions */}
          <Card className="bg-muted/30">
            <CardContent className="py-4">
              <div className="text-sm text-muted-foreground">
                <div className="font-medium mb-2">💡 一括印刷について:</div>
                <ul className="space-y-1 list-disc list-inside">
                  <li>本日承認された報告書を金融機関コード別にPDFファイルとして出力します</li>
                  <li>同じ金融機関の報告書は1つのPDFファイルにまとめられます</li>
                  <li>ファイル名形式: {`{金融機関コード}_BULK_{YYYYMMDD}_{連番}.pdf`}</li>
                  <li>承認者・担当者どちらでも実行可能です</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Footer */}
        <div className="border-t border-border pt-4 flex justify-end">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isLoading}
            data-testid="button-close"
          >
            閉じる
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}