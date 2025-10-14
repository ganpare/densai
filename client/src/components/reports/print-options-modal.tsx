import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { ReportWithDetails } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { FileDown } from "lucide-react";

interface PrintOptionsModalProps {
  report: ReportWithDetails;
  onClose: () => void;
}

export default function PrintOptionsModal({ report, onClose }: PrintOptionsModalProps) {
  const { toast } = useToast();

  // PDF generation mutation
  const generatePdfMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/reports/${report.id}/pdf/generate`);
      const result = await response.json();
      return result;
    },
    onSuccess: (data) => {
      toast({
        title: "PDF生成完了",
        description: "PDFファイルがサーバーに保存されました。",
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
        title: "PDF生成エラー",
        description: "PDF生成処理に失敗しました。",
        variant: "destructive",
      });
    },
  });

  const handleGenerateClick = () => {
    generatePdfMutation.mutate();
  };

  const isLoading = generatePdfMutation.isPending;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>PDF生成オプション</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            承認済みレポートのPDFをサーバーに生成・保存します。
          </div>
          
          <div className="space-y-2">
            <div className="text-sm font-medium">レポート情報:</div>
            <div className="text-sm text-muted-foreground">
              • 報告書番号: {report.reportNumber}
            </div>
            <div className="text-sm text-muted-foreground">
              • 会社名: {report.companyName}
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              キャンセル
            </Button>
            <Button 
              onClick={handleGenerateClick} 
              disabled={isLoading}
              className="flex items-center"
            >
              <FileDown className="mr-2 h-4 w-4" />
              {isLoading ? "生成中..." : "PDF生成"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}