import Sidebar from "@/components/layout/sidebar";
import BulkPrintModal from "@/components/reports/bulk-print-modal";

export default function BulkPrintPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="lg:pl-64 p-6">
        <div className="max-w-5xl mx-auto">
          <BulkPrintModal inline onClose={() => { /* no-op */ }} />
        </div>
      </main>
    </div>
  );
}


