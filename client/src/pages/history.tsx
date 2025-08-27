import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import ReportDetailModal from "@/components/reports/report-detail-modal";
import { ReportWithDetails } from "@shared/schema";
import { Search, Eye, FileText, Filter } from "lucide-react";

export default function History() {
  const { toast } = useToast();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [selectedReport, setSelectedReport] = useState<ReportWithDetails | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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

  // Build query parameters
  const queryParams = new URLSearchParams();
  if (debouncedSearch) {
    queryParams.set('search', debouncedSearch);
  }
  if (statusFilter !== 'all') {
    queryParams.set('status', statusFilter);
  }

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["/api/reports", queryParams.toString()],
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
        <Header title="履歴・検索" />
        
        <main className="p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">報告書履歴・検索</h2>
                <p className="text-muted-foreground">作成・担当した報告書の履歴と検索</p>
              </div>
            </div>

            {/* Search and Filter */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Search className="mr-2 h-5 w-5" />
                  検索・フィルター
                </CardTitle>
                <CardDescription>報告書番号、企業名、連絡者名、問い合わせ内容で検索できます</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder="検索キーワードを入力..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full"
                      data-testid="input-search"
                    />
                  </div>
                  <div className="w-full sm:w-48">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger data-testid="select-status-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">すべての状態</SelectItem>
                        <SelectItem value="draft">下書き</SelectItem>
                        <SelectItem value="pending_approval">承認待ち</SelectItem>
                        <SelectItem value="approved">承認済み</SelectItem>
                        <SelectItem value="rejected">差し戻し</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Results Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="mr-2 h-5 w-5" />
                  検索結果
                  {!isLoading && (
                    <Badge variant="secondary" className="ml-2">
                      {reports.length}件
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead data-testid="header-report-number">報告書番号</TableHead>
                        <TableHead data-testid="header-company">企業名</TableHead>
                        <TableHead data-testid="header-contact">連絡者</TableHead>
                        <TableHead data-testid="header-handler">対応者</TableHead>
                        <TableHead data-testid="header-status">状態</TableHead>
                        <TableHead data-testid="header-created">作成日時</TableHead>
                        <TableHead data-testid="header-actions">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            <div className="animate-pulse">検索中...</div>
                          </TableCell>
                        </TableRow>
                      ) : reports.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            {debouncedSearch || statusFilter !== 'all' 
                              ? "検索条件に一致する報告書が見つかりませんでした" 
                              : "報告書がありません"
                            }
                          </TableCell>
                        </TableRow>
                      ) : (
                        reports.map((report: ReportWithDetails) => (
                          <TableRow key={report.id} className="hover:bg-accent/50" data-testid={`row-report-${report.id}`}>
                            <TableCell className="font-medium" data-testid={`text-report-number-${report.id}`}>
                              {report.reportNumber}
                            </TableCell>
                            <TableCell data-testid={`text-company-${report.id}`}>
                              {report.companyName}
                            </TableCell>
                            <TableCell data-testid={`text-contact-${report.id}`}>
                              {report.contactPersonName}
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
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedReport(report)}
                                data-testid={`button-view-${report.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
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

      {/* Report Detail Modal */}
      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </div>
  );
}
