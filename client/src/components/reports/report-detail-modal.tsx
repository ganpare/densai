import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ReportWithDetails } from "@shared/schema";
import PrintModal from "./print-modal";
import { X, FileText, CheckCircle, XCircle, Printer, FileDown } from "lucide-react";

interface ReportDetailModalProps {
  report: ReportWithDetails;
  onClose: () => void;
  showApprovalActions?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
}

export default function ReportDetailModal({ 
  report, 
  onClose, 
  showApprovalActions = false,
  onApprove,
  onReject 
}: ReportDetailModalProps) {
  const { toast } = useToast();
  const [showPrintModal, setShowPrintModal] = useState(false);

  // PDF generation mutation
  const generatePdfMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", `/api/reports/${report.id}/pdf`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "PDF生成完了",
        description: "PDFの生成が完了しました。",
      });
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
        description: "PDFの生成に失敗しました。",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: "下書き", variant: "secondary" as const },
      pending_approval: { label: "承認待ち", variant: "default" as const },
      approved: { label: "承認済み", variant: "default" as const },
      rejected: { label: "差し戻し", variant: "destructive" as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    
    return (
      <Badge variant={config.variant} className={
        status === 'pending_approval' ? 'bg-warning/10 text-warning hover:bg-warning/20' :
        status === 'approved' ? 'bg-success/10 text-success hover:bg-success/20' : ''
      }>
        {config.label}
      </Badge>
    );
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handlePrintClick = () => {
    if (report.status !== 'approved') {
      toast({
        title: "印刷エラー",
        description: "承認済みの報告書のみ印刷可能です。",
        variant: "destructive",
      });
      return;
    }
    setShowPrintModal(true);
  };

  const handlePdfClick = () => {
    if (report.status !== 'approved') {
      toast({
        title: "PDF出力エラー",
        description: "承認済みの報告書のみPDF出力可能です。",
        variant: "destructive",
      });
      return;
    }
    generatePdfMutation.mutate();
  };

  return (
    <>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto custom-scrollbar" data-testid="dialog-report-detail">
          <DialogHeader className="border-b border-border pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center">
                <FileText className="mr-2 h-5 w-5" />
                報告書詳細
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                data-testid="button-close-modal"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Header with status */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold" data-testid="text-report-number">
                  {report.reportNumber}
                </h3>
                <p className="text-sm text-muted-foreground" data-testid="text-created-date">
                  作成日時: {formatDateTime(report.createdAt)}
                </p>
                {report.approvedAt && (
                  <p className="text-sm text-muted-foreground" data-testid="text-approved-date">
                    承認日時: {formatDateTime(report.approvedAt)}
                  </p>
                )}
              </div>
              <div data-testid="badge-status">
                {getStatusBadge(report.status)}
              </div>
            </div>

            {/* Report Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground">利用者番号</label>
                  <p className="text-foreground" data-testid="text-user-number">{report.userNumber}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground">金融機関コード</label>
                  <p className="text-foreground" data-testid="text-bank-code">{report.bankCode}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground">支店コード</label>
                  <p className="text-foreground" data-testid="text-branch-code">{report.branchCode}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground">企業名</label>
                  <p className="text-foreground" data-testid="text-company-name">{report.companyName}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground">連絡者氏名</label>
                  <p className="text-foreground" data-testid="text-contact-person">{report.contactPersonName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground">対応担当者</label>
                  <p className="text-foreground" data-testid="text-handler">
                    {report.handler.firstName} {report.handler.lastName}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground">承認者</label>
                  <p className="text-foreground" data-testid="text-approver">
                    {report.approver.firstName} {report.approver.lastName}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground">エスカレーション</label>
                  <p 
                    className={report.escalationRequired ? "text-destructive" : "text-muted-foreground"} 
                    data-testid="text-escalation"
                  >
                    {report.escalationRequired ? "必要" : "不要"}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Content sections */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">問い合わせ内容</label>
                <div className="p-4 bg-muted/50 rounded-md">
                  <p className="text-foreground whitespace-pre-wrap" data-testid="text-inquiry-content">
                    {report.inquiryContent}
                  </p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">対応内容</label>
                <div className="p-4 bg-muted/50 rounded-md">
                  <p className="text-foreground whitespace-pre-wrap" data-testid="text-response-content">
                    {report.responseContent}
                  </p>
                </div>
              </div>
              
              {report.escalationRequired && report.escalationReason && (
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">エスカレーション理由</label>
                  <div className="p-4 bg-muted/50 rounded-md">
                    <p className="text-foreground whitespace-pre-wrap" data-testid="text-escalation-reason">
                      {report.escalationReason}
                    </p>
                  </div>
                </div>
              )}

              {report.status === 'rejected' && report.rejectionReason && (
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">差し戻し理由</label>
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                    <p className="text-destructive whitespace-pre-wrap" data-testid="text-rejection-reason">
                      {report.rejectionReason}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Footer Actions */}
          <div className="border-t border-border pt-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {report.status === 'approved' && (
                <>
                  <Button 
                    variant="outline" 
                    onClick={handlePdfClick}
                    disabled={generatePdfMutation.isPending}
                    data-testid="button-pdf"
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    {generatePdfMutation.isPending ? "生成中..." : "PDF出力"}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handlePrintClick}
                    data-testid="button-print"
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    印刷
                  </Button>
                </>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              {showApprovalActions && report.status === 'pending_approval' && (
                <>
                  <Button
                    variant="outline"
                    onClick={onReject}
                    className="border-destructive text-destructive hover:bg-destructive/10"
                    data-testid="button-reject-modal"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    差し戻し
                  </Button>
                  <Button
                    onClick={onApprove}
                    className="bg-success text-white hover:bg-success/90"
                    data-testid="button-approve-modal"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    承認
                  </Button>
                </>
              )}
              <Button onClick={onClose} data-testid="button-close">
                閉じる
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Modal */}
      {showPrintModal && (
        <PrintModal
          reportId={report.id}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </>
  );
}
