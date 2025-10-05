import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import StatisticsCard from "@/components/reports/statistics-card";
import ReportDetailModal from "@/components/reports/report-detail-modal";
import { ReportWithDetails } from "@shared/schema";
import { Phone, Clock, CheckCircle, AlertTriangle, Plus, Eye, Edit, XCircle, Printer } from "lucide-react";

export default function Home() {
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

  const { data: statistics, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/statistics"],
    retry: false,
  });

  const { data: reports = [], isLoading: reportsLoading } = useQuery<ReportWithDetails[]>({
    queryKey: ["/api/reports"],
    retry: false,
  });

  const { data: pendingReports = [], isLoading: pendingLoading } = useQuery<ReportWithDetails[]>({
    queryKey: ["/api/reports", "pending"],
    enabled: (user as any)?.role === 'approver' || (user as any)?.role === 'admin',
    retry: false,
  });

  const { data: todayApprovedReports = [], isLoading: todayApprovedLoading } = useQuery<ReportWithDetails[]>({
    queryKey: ["/api/reports", "today-approved"],
    retry: false,
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

  const handleBatchPrint = async () => {
    try {
      const response = await fetch('/api/reports/batch-pdf/generate', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate batch PDF');
      }

      // Download the PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `batch_reports_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "PDF生成完了",
        description: "今日承認した報告書をまとめて印刷しました。",
      });
    } catch (error: any) {
      toast({
        title: "PDF生成エラー",
        description: error.message || "PDFの生成に失敗しました。",
        variant: "destructive",
      });
    }
  };

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

  const formatDateTime = (timestamp: number | null | undefined) => {
    if (!timestamp) return '-';
    // Unix timestamp (秒) → ミリ秒に変換
    return new Date(timestamp * 1000).toLocaleString('ja-JP', {
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
        <Header title="ダッシュボード" />
        
        <main className="p-6">
          <div className="space-y-6">
            {/* Batch Print Button */}
            {(todayApprovedReports as any[]).length > 0 && (
              <div className="flex justify-end">
                <Button 
                  onClick={handleBatchPrint}
                  className="bg-primary text-white"
                >
                  <Printer className="mr-2 h-4 w-4" />
                  今日承認した報告書をまとめて印刷 ({(todayApprovedReports as any[]).length}件)
                </Button>
              </div>
            )}

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatisticsCard
                title="今日の問い合わせ"
                value={(statistics as any)?.todayInquiries || 0}
                icon={<Phone className="text-primary text-xl" />}
                bgColor="bg-primary/10"
                loading={statsLoading}
                data-testid="card-today-inquiries"
              />
              <StatisticsCard
                title="承認待ち"
                value={(statistics as any)?.pendingApprovals || 0}
                icon={<Clock className="text-warning text-xl" />}
                bgColor="bg-warning/10"
                textColor="text-warning"
                loading={statsLoading}
                data-testid="card-pending-approvals"
              />
              <StatisticsCard
                title="今日完了"
                value={(statistics as any)?.todayCompleted || 0}
                icon={<CheckCircle className="text-success text-xl" />}
                bgColor="bg-success/10"
                textColor="text-success"
                loading={statsLoading}
                data-testid="card-today-completed"
              />
              <StatisticsCard
                title="エスカレーション"
                value={(statistics as any)?.escalations || 0}
                icon={<AlertTriangle className="text-destructive text-xl" />}
                bgColor="bg-destructive/10"
                textColor="text-destructive"
                loading={statsLoading}
                data-testid="card-escalations"
              />
            </div>

            {/* Recent Reports Table */}
            <Card>
              <CardHeader className="border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      {(user as any)?.role === 'approver' ? '承認した報告書' : '最近の報告書'}
                    </CardTitle>
                    <CardDescription>
                      {(user as any)?.role === 'approver' 
                        ? 'あなたが承認した報告書の一覧' 
                        : 'あなたが作成・担当した報告書の一覧'}
                    </CardDescription>
                  </div>
                  {(user as any)?.role !== 'approver' && (
                    <Link href="/reports/new">
                      <Button data-testid="button-create-report">
                        <Plus className="mr-2 h-4 w-4" />
                        新規作成
                      </Button>
                    </Link>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead data-testid="header-report-id">報告書ID</TableHead>
                        <TableHead data-testid="header-company">企業名</TableHead>
                        <TableHead data-testid="header-handler">対応者</TableHead>
                        <TableHead data-testid="header-status">状態</TableHead>
                        <TableHead data-testid="header-created">作成日時</TableHead>
                        <TableHead data-testid="header-actions">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportsLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <div className="animate-pulse">読み込み中...</div>
                          </TableCell>
                        </TableRow>
                      ) : reports.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            報告書がありません
                          </TableCell>
                        </TableRow>
                      ) : (
                        (reports as ReportWithDetails[]).slice(0, 10).map((report: ReportWithDetails) => (
                          <TableRow key={report.id} className="hover:bg-accent/50">
                            <TableCell className="font-medium" data-testid={`text-report-id-${report.id}`}>
                              {report.reportNumber}
                            </TableCell>
                            <TableCell data-testid={`text-company-${report.id}`}>
                              {report.companyName}
                            </TableCell>
                            <TableCell data-testid={`text-handler-${report.id}`}>
                              {report.handler.firstName} {report.handler.lastName}
                            </TableCell>
                            <TableCell data-testid={`status-${report.id}`}>
                              {getStatusBadge(report.status)}
                            </TableCell>
                            <TableCell className="text-muted-foreground" data-testid={`text-created-${report.id}`}>
                              {formatDateTime(report.createdAt)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedReport(report)}
                                  data-testid={`button-view-${report.id}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {report.status === 'draft' && (
                                  <Link href={`/reports/${report.id}/edit`}>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      data-testid={`button-edit-${report.id}`}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </Link>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Pending Approvals Section for Approvers */}
            {((user as any)?.role === 'approver' || (user as any)?.role === 'admin') && (
              <Card>
                <CardHeader className="border-b border-border">
                  <CardTitle>承認待ち報告書</CardTitle>
                  <CardDescription>承認が必要な報告書の一覧</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {pendingLoading ? (
                    <div className="py-8 text-center">
                      <div className="animate-pulse">読み込み中...</div>
                    </div>
                  ) : (pendingReports as any[]).length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      承認待ちの報告書はありません
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {(pendingReports as ReportWithDetails[]).slice(0, 5).map((report: ReportWithDetails) => (
                        <div key={report.id} className="p-4 hover:bg-accent/50">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="font-semibold">{report.reportNumber}</h3>
                              <p className="text-sm text-muted-foreground">
                                提出日時: {formatDateTime(report.createdAt)}
                              </p>
                            </div>
                            <Badge variant="secondary" className="bg-warning/10 text-warning">
                              承認待ち
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                            <div>
                              <span className="font-medium text-muted-foreground">企業名:</span>
                              <p>{report.companyName}</p>
                            </div>
                            <div>
                              <span className="font-medium text-muted-foreground">対応者:</span>
                              <p>{report.handler.firstName} {report.handler.lastName}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-end space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setSelectedReport(report)}
                            >
                              <Eye className="mr-1 h-4 w-4" />
                              詳細
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleReject(report.id)}
                              disabled={rejectMutation.isPending}
                              className="border-destructive text-destructive hover:bg-destructive/10"
                            >
                              <XCircle className="mr-1 h-4 w-4" />
                              差し戻し
                            </Button>
                            <Button 
                              size="sm"
                              onClick={() => handleApprove(report.id)}
                              disabled={approveMutation.isPending}
                              className="bg-success text-white hover:bg-success/90"
                            >
                              <CheckCircle className="mr-1 h-4 w-4" />
                              承認
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>

      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          showApprovalActions={
            ((user as any)?.role === 'approver' || (user as any)?.role === 'admin') &&
            selectedReport.status === 'pending_approval'
          }
          onApprove={() => handleApprove(selectedReport.id)}
          onReject={() => handleReject(selectedReport.id)}
        />
      )}

      {/* Rejection Dialog */}
      <Dialog open={rejectionDialog.open} onOpenChange={(open) => setRejectionDialog({ ...rejectionDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>差し戻し理由</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="差し戻し理由を入力してください..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="h-24"
            />
            <div className="flex items-center justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setRejectionDialog({ open: false, reportId: "" });
                  setRejectionReason("");
                }}
              >
                キャンセル
              </Button>
              <Button 
                onClick={confirmReject}
                disabled={rejectMutation.isPending || !rejectionReason.trim()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
