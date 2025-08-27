import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, Link } from "wouter";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { insertReportSchema } from "@shared/schema";
import { ArrowLeft, Save, Send } from "lucide-react";

const reportFormSchema = insertReportSchema.extend({
  escalationRequired: z.boolean(),
  escalationReason: z.string().optional(),
});

type ReportFormData = z.infer<typeof reportFormSchema>;

export default function ReportForm() {
  const { toast } = useToast();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const [, navigate] = useLocation();

  // Extract report ID from URL for editing
  const isEdit = location.includes('/edit');
  const reportId = isEdit ? location.split('/')[2] : null;

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

  const form = useForm<ReportFormData>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      userNumber: "",
      bankCode: "",
      branchCode: "",
      companyName: "",
      contactPersonName: "",
      approverId: "",
      inquiryContent: "",
      responseContent: "",
      escalationRequired: false,
      escalationReason: "",
    },
  });

  // Load existing report for editing
  const { data: existingReport, isLoading: reportLoading } = useQuery({
    queryKey: ["/api/reports", reportId],
    enabled: !!reportId,
    retry: false,
  });
  
  // Update form when data loads
  useEffect(() => {
    if (existingReport) {
      const data = existingReport as any;
      form.reset({
        userNumber: data.userNumber,
        bankCode: data.bankCode,
        branchCode: data.branchCode,
        companyName: data.companyName,
        contactPersonName: data.contactPersonName,
        approverId: data.approverId,
        inquiryContent: data.inquiryContent,
        responseContent: data.responseContent,
        escalationRequired: data.escalationRequired,
        escalationReason: data.escalationReason || "",
      });
    }
  }, [existingReport, form]);

  // Get approvers for dropdown
  const { data: approvers = [] } = useQuery({
    queryKey: ["/api/users", "approver"],
    retry: false,
  });

  // Save draft mutation
  const saveDraftMutation = useMutation({
    mutationFn: async (data: ReportFormData) => {
      const url = reportId ? `/api/reports/${reportId}` : "/api/reports";
      const method = reportId ? "PATCH" : "POST";
      return await apiRequest(method, url, data);
    },
    onSuccess: () => {
      toast({
        title: "保存完了",
        description: "下書きを保存しました。",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      navigate("/");
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
        title: "保存エラー",
        description: "報告書の保存に失敗しました。",
        variant: "destructive",
      });
    },
  });

  // Submit for approval mutation
  const submitMutation = useMutation({
    mutationFn: async (data: ReportFormData) => {
      if (reportId) {
        // Update existing report first
        await apiRequest("PATCH", `/api/reports/${reportId}`, data);
        // Then submit for approval
        return await apiRequest("PATCH", `/api/reports/${reportId}/submit`);
      } else {
        // Create new report
        const response = await apiRequest("POST", "/api/reports", data);
        const report = await response.json();
        // Submit for approval
        return await apiRequest("PATCH", `/api/reports/${report.id}/submit`);
      }
    },
    onSuccess: () => {
      toast({
        title: "提出完了",
        description: "承認申請を提出しました。",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
      navigate("/");
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
        title: "提出エラー",
        description: "承認申請の提出に失敗しました。",
        variant: "destructive",
      });
    },
  });

  const onSaveDraft = (data: ReportFormData) => {
    saveDraftMutation.mutate(data);
  };

  const onSubmit = (data: ReportFormData) => {
    submitMutation.mutate(data);
  };

  const escalationRequired = form.watch("escalationRequired");

  if (authLoading || (reportId && reportLoading)) {
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
        <Header title={isEdit ? "報告書編集" : "報告書作成"} />
        
        <main className="p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                {isEdit ? "問い合わせ対応報告書編集" : "問い合わせ対応報告書作成"}
              </h2>
              <Link href="/">
                <Button variant="ghost" data-testid="button-back">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  戻る
                </Button>
              </Link>
            </div>

            <Form {...form}>
              <form className="space-y-6">
                {/* Basic Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>基本情報</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="userNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>利用者番号 <span className="text-destructive">*</span></FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="12345678" 
                                {...field} 
                                data-testid="input-user-number"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="bankCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>金融機関コード <span className="text-destructive">*</span></FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="0001" 
                                {...field} 
                                data-testid="input-bank-code"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="branchCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>支店コード <span className="text-destructive">*</span></FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="001" 
                                {...field} 
                                data-testid="input-branch-code"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="companyName"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>企業名 <span className="text-destructive">*</span></FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="株式会社サンプル商事" 
                                {...field} 
                                data-testid="input-company-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="contactPersonName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>連絡者氏名 <span className="text-destructive">*</span></FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="田中太郎" 
                                {...field} 
                                data-testid="input-contact-person"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Response Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>対応情報</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="approverId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>承認者 <span className="text-destructive">*</span></FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-approver">
                                    <SelectValue placeholder="選択してください" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {(approvers as any[]).map((approver: any) => (
                                    <SelectItem key={approver.id} value={approver.id}>
                                      {approver.firstName} {approver.lastName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={form.control}
                        name="inquiryContent"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>問い合わせ内容 <span className="text-destructive">*</span></FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="電子債権の記録方法について質問をいただきました..." 
                                className="h-24" 
                                {...field} 
                                data-testid="textarea-inquiry-content"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="responseContent"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>対応内容 <span className="text-destructive">*</span></FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="操作手順を詳しく説明し、画面を共有しながら..." 
                                className="h-24" 
                                {...field} 
                                data-testid="textarea-response-content"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="escalationRequired"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>エスカレーション</FormLabel>
                            <FormControl>
                              <RadioGroup
                                onValueChange={(value) => field.onChange(value === "true")}
                                value={field.value ? "true" : "false"}
                                className="flex items-center space-x-4"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="true" id="escalation-yes" data-testid="radio-escalation-yes" />
                                  <Label htmlFor="escalation-yes">必要</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="false" id="escalation-no" data-testid="radio-escalation-no" />
                                  <Label htmlFor="escalation-no">不要</Label>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {escalationRequired && (
                        <FormField
                          control={form.control}
                          name="escalationReason"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>エスカレーション理由</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="技術的な問題が発生し、システム部門での対応が必要..." 
                                  className="h-20" 
                                  {...field} 
                                  data-testid="textarea-escalation-reason"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Form Actions */}
                <div className="flex items-center justify-end space-x-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={form.handleSubmit(onSaveDraft)}
                    disabled={saveDraftMutation.isPending}
                    data-testid="button-save-draft"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {saveDraftMutation.isPending ? "保存中..." : "下書き保存"}
                  </Button>
                  <Button 
                    type="button" 
                    onClick={form.handleSubmit(onSubmit)}
                    disabled={submitMutation.isPending}
                    data-testid="button-submit"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {submitMutation.isPending ? "提出中..." : "承認申請"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </main>
      </div>
    </div>
  );
}
