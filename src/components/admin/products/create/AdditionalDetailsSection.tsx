import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function AdditionalDetailsSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Additional Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="material">Material</Label>
          <Input id="material" placeholder="100% Cotton" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="care">Care Instructions</Label>
          <Textarea
            id="care"
            placeholder="Machine wash cold, tumble dry low"
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  );
}
