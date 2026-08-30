import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

interface TopProductsListProps {
  products: Array<{
    productId: string | null;
    productName: string;
    totalQuantity: number;
    totalRevenue: number;
  }>;
}

export function TopProductsList({ products }: TopProductsListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Top Selling Products
        </CardTitle>
      </CardHeader>
      <CardContent>
        {products.length > 0 ? (
          <div className="space-y-4">
            {products.map((product, index) => (
              <div
                key={product.productId || index}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-bold">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium text-sm">{product.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.totalQuantity} units sold
                    </p>
                  </div>
                </div>
                <span className="font-semibold text-sm">
                  {formatCurrency(product.totalRevenue)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            No product sales data for this period
          </p>
        )}
      </CardContent>
    </Card>
  );
}
