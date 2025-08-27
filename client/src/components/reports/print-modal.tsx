import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { FileDown, Printer } from "lucide-react";
import jsPDF from 'jspdf';

interface PrintModalProps {
  reportId: string;
  onClose: () => void;
}

export default function PrintModal({ reportId, onClose }: PrintModalProps) {
  const { toast } = useToast();
  const [printOption, setPrintOption] = useState("pdf");
  const [selectedPrinter, setSelectedPrinter] = useState("");

  // Available printers (in a real implementation, this would come from an API)
  const printers = [
    { id: "main_office_01", name: "本店_金庫連携プリンター_01" },
    { id: "branch_office_02", name: "支店_金庫連携プリンター_02" },
    { id: "headquarters_03", name: "本部_金庫連携プリンター_03" },
  ];

  // PDF generation mutation
  const generatePdfMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", `/api/reports/${reportId}/pdf`);
      const result = await response.json();
      return result;
    },
    onSuccess: (data) => {
      if (data.success && data.data) {
        generateAndDownloadPDF(data.data);
        toast({
          title: "PDF出力完了",
          description: "PDFファイルのダウンロードが開始されました。",
        });
      } else {
        throw new Error("PDF data not available");
      }
      onClose();
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
        title: "PDF出力エラー",
        description: "PDFの生成に失敗しました。",
        variant: "destructive",
      });
    },
  });

  // Printer execution mutation (placeholder)
  const printMutation = useMutation({
    mutationFn: async (printerId: string) => {
      // TODO: Implement actual printer integration
      // This would integrate with the electronic document system
      return new Promise(resolve => setTimeout(resolve, 1000));
    },
    onSuccess: () => {
      toast({
        title: "印刷完了",
        description: "指定プリンターでの印刷が完了しました。金庫に報告書が送信されました。",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "印刷エラー",
        description: "印刷に失敗しました。",
        variant: "destructive",
      });
    },
  });

  const handleExecute = () => {
    if (printOption === "pdf") {
      generatePdfMutation.mutate();
    } else if (printOption === "printer") {
      if (!selectedPrinter) {
        toast({
          title: "選択エラー",
          description: "プリンターを選択してください。",
          variant: "destructive",
        });
        return;
      }
      printMutation.mutate(selectedPrinter);
    }
  };

  // PDF生成関数
  const generateAndDownloadPDF = (reportData: any) => {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // 日本語フォントの設定が必要な場合は、カスタムフォントを追加
    
    // PDFタイトル
    pdf.setFontSize(16);
    pdf.text('電子債権問い合わせ対応報告書', 20, 20);
    
    // 基本情報
    pdf.setFontSize(12);
    let yPos = 40;
    
    pdf.text(`報告書番号: ${reportData.reportNumber}`, 20, yPos);
    yPos += 10;
    pdf.text(`ユーザー番号: ${reportData.userNumber}`, 20, yPos);
    yPos += 10;
    pdf.text(`金庫コード: ${reportData.bankCode}`, 20, yPos);
    yPos += 10;
    pdf.text(`支店コード: ${reportData.branchCode}`, 20, yPos);
    yPos += 10;
    pdf.text(`企業名: ${reportData.companyName}`, 20, yPos);
    yPos += 10;
    pdf.text(`担当者: ${reportData.contactPersonName}`, 20, yPos);
    yPos += 15;
    
    // 問い合わせ内容
    pdf.text('問い合わせ内容:', 20, yPos);
    yPos += 10;
    const inquiryLines = pdf.splitTextToSize(reportData.inquiryContent, 170);
    pdf.text(inquiryLines, 20, yPos);
    yPos += inquiryLines.length * 5 + 10;
    
    // 回答内容
    pdf.text('回答内容:', 20, yPos);
    yPos += 10;
    const responseLines = pdf.splitTextToSize(reportData.responseContent, 170);
    pdf.text(responseLines, 20, yPos);
    yPos += responseLines.length * 5 + 10;
    
    // エスカレーション情報
    if (reportData.escalationRequired) {
      pdf.text('エスカレーション理由:', 20, yPos);
      yPos += 10;
      const escalationLines = pdf.splitTextToSize(reportData.escalationReason || '', 170);
      pdf.text(escalationLines, 20, yPos);
      yPos += escalationLines.length * 5 + 10;
    }
    
    // 承認情報
    pdf.text(`作成者: ${reportData.handlerName}`, 20, yPos);
    yPos += 10;
    pdf.text(`承認者: ${reportData.approverName}`, 20, yPos);
    yPos += 10;
    
    if (reportData.approvedAt) {
      const approvedDate = new Date(reportData.approvedAt * 1000).toLocaleDateString('ja-JP');
      pdf.text(`承認日時: ${approvedDate}`, 20, yPos);
    }
    
    // PDFをダウンロード
    pdf.save(`報告書_${reportData.reportNumber}.pdf`);
  };

  const isExecuting = generatePdfMutation.isPending || printMutation.isPending;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md" data-testid="dialog-print-options">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle>印刷オプション</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <RadioGroup
            value={printOption}
            onValueChange={setPrintOption}
            className="space-y-3"
          >
            <Label 
              htmlFor="pdf-option"
              className="flex items-center p-3 border border-border rounded-md cursor-pointer hover:bg-accent transition-colors"
              data-testid="option-pdf"
            >
              <RadioGroupItem value="pdf" id="pdf-option" className="mr-3" />
              <div>
                <div className="flex items-center font-medium">
                  <FileDown className="mr-2 h-4 w-4" />
                  PDF出力
                </div>
                <div className="text-sm text-muted-foreground">PDFファイルとしてダウンロード</div>
              </div>
            </Label>
            
            <Label 
              htmlFor="printer-option"
              className="flex items-center p-3 border border-border rounded-md cursor-pointer hover:bg-accent transition-colors"
              data-testid="option-printer"
            >
              <RadioGroupItem value="printer" id="printer-option" className="mr-3" />
              <div>
                <div className="flex items-center font-medium">
                  <Printer className="mr-2 h-4 w-4" />
                  指定プリンター
                </div>
                <div className="text-sm text-muted-foreground">電子帳票システム連携</div>
              </div>
            </Label>
          </RadioGroup>
          
          {printOption === "printer" && (
            <div className="space-y-2">
              <Label className="block text-sm font-medium text-foreground">プリンター選択</Label>
              <Select value={selectedPrinter} onValueChange={setSelectedPrinter}>
                <SelectTrigger data-testid="select-printer">
                  <SelectValue placeholder="プリンターを選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {printers.map((printer) => (
                    <SelectItem key={printer.id} value={printer.id}>
                      {printer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        
        <div className="border-t border-border pt-4 flex items-center justify-end space-x-2">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isExecuting}
            data-testid="button-cancel-print"
          >
            キャンセル
          </Button>
          <Button 
            onClick={handleExecute}
            disabled={isExecuting}
            data-testid="button-execute-print"
          >
            {isExecuting ? (
              printOption === "pdf" ? "生成中..." : "印刷中..."
            ) : (
              "実行"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
