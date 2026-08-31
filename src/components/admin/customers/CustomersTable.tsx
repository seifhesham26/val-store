import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Eye } from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/currency";

export interface CustomerRow {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  createdAt: Date | string;
  orderCount: number;
  totalSpent: number;
}

interface CustomersTableProps {
  customers: CustomerRow[];
  onViewCustomer: (id: string) => void;
}

export function CustomersTable({
  customers,
  onViewCustomer,
}: CustomersTableProps) {
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="text-right">Orders</TableHead>
            <TableHead className="text-right">Total Spent</TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center py-8 text-muted-foreground"
              >
                No customers found
              </TableCell>
            </TableRow>
          )}
          {customers.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={c.image ?? undefined} />
                    <AvatarFallback>
                      {c.name?.charAt(0).toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{c.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{c.email}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {format(new Date(c.createdAt), "MMM d, yyyy")}
              </TableCell>
              <TableCell className="text-right">
                <Badge variant="outline">{c.orderCount}</Badge>
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(c.totalSpent)}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onViewCustomer(c.id)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
