import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import ReportDetailModal from "@/components/reports/report-detail-modal";
import { ReportWithDetails } from "@shared/schema";
import { Eye, CheckCircle, XCircle, Clock } from "lucide-react";

export default function Approval() {
  const { toast } = useToast();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [selectedReport, setSelectedReport] = useState<ReportWithDetails | null>(null);
  const [rejectionDialog, setRejectionDialog] = useState<{ open: boolean; reportId: string }>({
    open: false,
    reportId: "",
  });
  const [rejectionReason, setRejectionReason] = useState("");

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
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
  }, [isAuthenticated, authLoading, toast]);

  const { data: pendingReports = [], isLoading } = useQuery({
    queryKey: ["/api/reports", "pending"],
    retry: false,
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
    },
  });

  // Approve report mutation
  const approveMutation = useMutation({
    mutationFn: async (reportId: string) => {
      return await apiRequest("PATCH", `/api/reports/${reportId}/status`, {
        status: "approved",
      });
    },
    onSuccess: () => {
      toast({
        title: "承認完了",
        description: "報告書を承認しました。",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
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
        title: "承認エラー",
        description: "報告書の承認に失敗しました。",
        variant: "destructive",
      });
    },
  });

  // Reject report mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ reportId, reason }: { reportId: string; reason: string }) => {
      return await apiRequest("PATCH", `/api/reports/${reportId}/status`, {
        status: "rejected",
        rejectionReason: reason,
      });
    },
    onSuccess: () => {
      toast({
        title: "差し戻し完了",
        description: "報告書を差し戻しました。",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
      setRejectionDialog({ open: false, reportId: "" });
      setRejectionReason("");
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
        title: "差し戻しエラー",
        description: "報告書の差し戻しに失敗しました。",
        variant: "destructive",
      });
    },
  });

  const handleApprove = (reportId: string) => {
    approveMutation.mutate(reportId);
  };

  const handleReject = (reportId: string) => {
    setRejectionDialog({ open: true, reportId });
  };

  const confirmReject = () => {
    if (rejectionReason.trim()) {
      rejectMutation.mutate({
        reportId: rejectionDialog.reportId,
        reason: rejectionReason.trim(),
      });
    } else {
      toast({
        title: "入力エラー",
        description: "差し戻し理由を入力してください。",
        variant: "destructive",
      });
    }
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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <div className="lg:pl-64">
        <Header title="承認待ち" />
        
        <main className="p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">承認待ち報告書</h2>
                <p className="text-muted-foreground">
                  承認権限: <span className="text-primary font-medium">レベル{user?.approvalLevel || 1}</span>
                </p>
              </div>
              {pendingReports.length > 0 && (
                <Badge variant="secondary" className="bg-warning/10 text-warning">
                  <Clock className="mr-1 h-3 w-3" />
                  {pendingReports.length}件待ち
                </Badge>
              )}
            </div>

            {/* Approval Cards */}
            <div className="space-y-4">
              {isLoading ? (
                <Card>
                  <CardContent className="py-8">
                    <div className="text-center">
                      <div className="animate-pulse">読み込み中...</div>
                    </div>
                  </CardContent>
                </Card>
              ) : pendingReports.length === 0 ? (
                <Card>
                  <CardContent className="py-8">
                    <div className="text-center text-muted-foreground">
                      承認待ちの報告書はありません
                    </div>
                  </CardContent>
                </Card>
              ) : (
                pendingReports.map((report: ReportWithDetails) => (
                  <Card key={report.id} data-testid={`card-report-${report.id}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold" data-testid={`text-report-number-${report.id}`}>
                            {report.reportNumber}
                          </h3>
                          <p className="text-sm text-muted-foreground" data-testid={`text-submitted-at-${report.id}`}>
                            提出日時: {formatDateTime(report.createdAt)}
                          </p>
                        </div>
                        <Badge variant="secondary" className="bg-warning/10 text-warning">
                          承認待ち
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 text-sm">
                        <div>
                          <span className="font-medium text-muted-foreground">企業名:</span>
                          <p data-testid={`text-company-${report.id}`}>{report.companyName}</p>
                        </div>
                        <div>
                          <span className="font-medium text-muted-foreground">連絡者:</span>
                          <p data-testid={`text-contact-${report.id}`}>{report.contactPersonName}</p>
                        </div>
                        <div>
                          <span className="font-medium text-muted-foreground">対応者:</span>
                          <p data-testid={`text-handler-${report.id}`}>
                            {report.handler.firstName} {report.handler.lastName}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium text-muted-foreground">エスカレーション:</span>
                          <p className={report.escalationRequired ? "text-destructive" : "text-muted-foreground"} data-testid={`text-escalation-${report.id}`}>
                            {report.escalationRequired ? "必要" : "不要"}
                          </p>
                        </div>
                      </div>
                      
                      <div className="border-t border-border pt-4">
                        <div className="flex items-center justify-between">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedReport(report)}
                            data-testid={`button-view-detail-${report.id}`}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            詳細を表示
                          </Button>
                          <div className="flex items-center space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleReject(report.id)}
                              disabled={rejectMutation.isPending}
                              className="border-destructive text-destructive hover:bg-destructive/10"
                              data-testid={`button-reject-${report.id}`}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              差し戻し
                            </Button>
                            <Button 
                              size="sm"
                              onClick={() => handleApprove(report.id)}
                              disabled={approveMutation.isPending}
                              className="bg-success text-white hover:bg-success/90"
                              data-testid={`button-approve-${report.id}`}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              承認
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Report Detail Modal */}
      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          showApprovalActions={true}
          onApprove={() => handleApprove(selectedReport.id)}
          onReject={() => handleReject(selectedReport.id)}
        />
      )}

      {/* Rejection Dialog */}
      <Dialog open={rejectionDialog.open} onOpenChange={(open) => setRejectionDialog({ ...rejectionDialog, open })}>
        <DialogContent data-testid="dialog-rejection">
          <DialogHeader>
            <DialogTitle>差し戻し理由</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="差し戻し理由を入力してください..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="h-24"
              data-testid="textarea-rejection-reason"
            />
            <div className="flex items-center justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setRejectionDialog({ open: false, reportId: "" });
                  setRejectionReason("");
                }}
                data-testid="button-cancel-reject"
              >
                キャンセル
              </Button>
              <Button 
                onClick={confirmReject}
                disabled={rejectMutation.isPending || !rejectionReason.trim()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-reject"
              >
                差し戻し
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
