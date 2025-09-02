import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { ReportWithDetails } from "@shared/schema";
import { X, Printer, FileDown, Save, Settings } from "lucide-react";
import jsPDF from 'jspdf';

interface PrintOptionsModalProps {
  report: ReportWithDetails;
  onClose: () => void;
}

export default function PrintOptionsModal({ report, onClose }: PrintOptionsModalProps) {
  const { toast } = useToast();
  const [selectedOption, setSelectedOption] = useState<'print' | 'save' | null>(null);

  // PDF Print/Save mutation
  const printPdfMutation = useMutation({
    mutationFn: async (action: 'print' | 'save') => {
      const response = await apiRequest("POST", `/api/reports/${report.id}/print-pdf`, {
        action: action
      });
      const result = await response.json();
      return result;
    },
    onSuccess: async (data) => {
      if (data.action === 'print') {
        // Open print dialog with HTML content
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(data.htmlContent);
          printWindow.document.close();
          
          // Wait for content to load, then print
          printWindow.onload = () => {
            printWindow.print();
            printWindow.close();
          };
          
          toast({
            title: "印刷開始",
            description: "電子帳票の印刷を開始しました。",
          });
        }
      } else if (data.action === 'save') {
        // Convert HTML to PDF and save to server
        await convertAndSavePDF(data.htmlContent, data.filename);
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
        title: "印刷エラー",
        description: "印刷処理に失敗しました。",
        variant: "destructive",
      });
    },
  });

  // Save PDF to server mutation
  const savePdfMutation = useMutation({
    mutationFn: async ({ filename, pdfBuffer }: { filename: string; pdfBuffer: string }) => {
      const response = await apiRequest("POST", `/api/reports/${report.id}/save-pdf`, {
        filename: filename,
        pdfBuffer: pdfBuffer
      });
      const result = await response.json();
      return result;
    },
    onSuccess: (data) => {
      toast({
        title: "PDF保存完了",
        description: `PDFファイル「${data.filename}」を保存しました。`,
      });
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
        title: "PDF保存エラー",
        description: "PDFの保存に失敗しました。",
        variant: "destructive",
      });
    },
  });

  // Convert HTML to PDF and save to server
  const convertAndSavePDF = async (htmlContent: string, filename: string) => {
    try {
      // Create a temporary div to render HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
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

      // Convert HTML to PDF (simplified version - you might want to use html2canvas for better results)
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

      // Convert PDF to base64
      const pdfBuffer = pdf.output('datauristring').split(',')[1];
      
      // Save to server
      await savePdfMutation.mutateAsync({
        filename: filename,
        pdfBuffer: pdfBuffer
      });

    } catch (error) {
      console.error('PDF conversion error:', error);
      toast({
        title: "PDF変換エラー",
        description: "PDFの変換に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const handlePrintClick = () => {
    setSelectedOption('print');
    printPdfMutation.mutate('print');
  };

  const handleSaveClick = () => {
    setSelectedOption('save');
    printPdfMutation.mutate('save');
  };

  const isLoading = printPdfMutation.isPending || savePdfMutation.isPending;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md" data-testid="dialog-print-options">
        <DialogHeader className="border-b border-border pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center">
              <Settings className="mr-2 h-5 w-5" />
              印刷オプション
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              data-testid="button-close-print-options"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="text-sm text-muted-foreground mb-4">
            印刷方法を選択してください：
          </div>

          {/* Electronic Form Print Option */}
          <Card 
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedOption === 'print' ? 'ring-2 ring-primary' : ''
            }`}
          >
            <CardContent className="p-4">
              <Button
                variant="outline"
                className="w-full justify-start h-auto p-0 border-none bg-transparent hover:bg-transparent"
                onClick={handlePrintClick}
                disabled={isLoading}
                data-testid="button-electronic-print"
              >
                <div className="flex items-start space-x-3 w-full">
                  <Printer className="h-6 w-6 text-primary mt-1" />
                  <div className="text-left">
                    <div className="font-medium">電子帳票印刷</div>
                    <div className="text-sm text-muted-foreground">
                      規定のプリンターに直接印刷します
                    </div>
                  </div>
                </div>
              </Button>
            </CardContent>
          </Card>

          {/* PDF Save Option */}
          <Card 
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedOption === 'save' ? 'ring-2 ring-primary' : ''
            }`}
          >
            <CardContent className="p-4">
              <Button
                variant="outline"
                className="w-full justify-start h-auto p-0 border-none bg-transparent hover:bg-transparent"
                onClick={handleSaveClick}
                disabled={isLoading}
                data-testid="button-pdf-save"
              >
                <div className="flex items-start space-x-3 w-full">
                  <Save className="h-6 w-6 text-success mt-1" />
                  <div className="text-left">
                    <div className="font-medium">PDF保存</div>
                    <div className="text-sm text-muted-foreground">
                      サーバーにPDFファイルとして保存します
                    </div>
                  </div>
                </div>
              </Button>
            </CardContent>
          </Card>

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
              <div className="text-sm text-muted-foreground">
                {selectedOption === 'print' ? '印刷準備中...' : 'PDF生成中...'}
              </div>
            </div>
          )}

          {/* Report Info */}
          <div className="bg-muted/50 rounded-md p-3 text-sm">
            <div className="font-medium mb-1">対象報告書</div>
            <div className="text-muted-foreground">
              {report.reportNumber} - {report.companyName}
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="border-t border-border pt-4 flex justify-end">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isLoading}
            data-testid="button-cancel-print"
          >
            キャンセル
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}