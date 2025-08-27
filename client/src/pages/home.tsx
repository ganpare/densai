import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import StatisticsCard from "@/components/reports/statistics-card";
import ReportDetailModal from "@/components/reports/report-detail-modal";
import { ReportWithDetails } from "@shared/schema";
import { Phone, Clock, CheckCircle, AlertTriangle, Plus, Eye, Edit } from "lucide-react";

export default function Home() {
  const { toast } = useToast();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [selectedReport, setSelectedReport] = useState<ReportWithDetails | null>(null);

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
                title="今月完了"
                value={(statistics as any)?.monthlyCompleted || 0}
                icon={<CheckCircle className="text-success text-xl" />}
                bgColor="bg-success/10"
                textColor="text-success"
                loading={statsLoading}
                data-testid="card-monthly-completed"
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
                    <CardTitle>最近の報告書</CardTitle>
                    <CardDescription>あなたが作成・担当した報告書の一覧</CardDescription>
                  </div>
                  <Link href="/reports/new">
                    <Button data-testid="button-create-report">
                      <Plus className="mr-2 h-4 w-4" />
                      新規作成
                    </Button>
                  </Link>
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
                              {formatDateTime(report.createdAt?.toString() || '')}
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
          </div>
        </main>
      </div>

      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </div>
  );
}
