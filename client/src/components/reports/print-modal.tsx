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
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "PDF出力完了",
        description: "PDFファイルの生成が完了しました。",
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
