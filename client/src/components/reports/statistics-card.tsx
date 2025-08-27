import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatisticsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  bgColor?: string;
  textColor?: string;
  loading?: boolean;
  "data-testid"?: string;
}

export default function StatisticsCard({ 
  title, 
  value, 
  icon, 
  bgColor = "bg-primary/10", 
  textColor = "text-foreground",
  loading = false,
  "data-testid": testId
}: StatisticsCardProps) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground" data-testid={`${testId}-title`}>
              {title}
            </p>
            <p 
              className={cn("text-2xl font-bold", textColor)} 
              data-testid={`${testId}-value`}
            >
              {loading ? (
                <span className="animate-pulse">-</span>
              ) : (
                value
              )}
            </p>
          </div>
          <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", bgColor)}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
