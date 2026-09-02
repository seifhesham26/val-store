import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Body measurement ranges in cm, keyed to the variant sizes the store
// actually sells (`XS`–`XXL`, see scripts/seed.ts). Grouped by the garment
// categories in the catalogue (Men: T-Shirts/Shirts, Pants — Women:
// Dresses/Tops, Skirts) rather than one generic chart, since chest/bust and
// waist/hip ranges differ by cut.
type SizeChart = {
  title: string;
  columns: string[];
  rows: { size: string; values: string[] }[];
};

const menTops: SizeChart = {
  title: "Tops & Shirts",
  columns: ["Chest (cm)", "Waist (cm)"],
  rows: [
    { size: "XS", values: ["86–89", "71–74"] },
    { size: "S", values: ["91–94", "76–79"] },
    { size: "M", values: ["97–100", "81–84"] },
    { size: "L", values: ["102–105", "86–89"] },
    { size: "XL", values: ["107–110", "91–94"] },
    { size: "XXL", values: ["112–117", "96–101"] },
  ],
};

const menPants: SizeChart = {
  title: "Pants",
  columns: ["Waist (cm)", "Hip (cm)", "Inseam (cm)"],
  rows: [
    { size: "XS", values: ["71–74", "86–89", "78"] },
    { size: "S", values: ["76–79", "91–94", "79"] },
    { size: "M", values: ["81–84", "96–99", "80"] },
    { size: "L", values: ["86–89", "101–104", "81"] },
    { size: "XL", values: ["91–94", "106–109", "82"] },
    { size: "XXL", values: ["96–101", "111–116", "83"] },
  ],
};

const womenTops: SizeChart = {
  title: "Tops & Dresses",
  columns: ["Bust (cm)", "Waist (cm)", "Hip (cm)"],
  rows: [
    { size: "XS", values: ["78–81", "60–63", "86–89"] },
    { size: "S", values: ["83–86", "65–68", "91–94"] },
    { size: "M", values: ["88–91", "70–73", "96–99"] },
    { size: "L", values: ["93–97", "75–79", "101–105"] },
    { size: "XL", values: ["99–104", "81–86", "107–112"] },
    { size: "XXL", values: ["106–111", "88–93", "114–119"] },
  ],
};

const womenSkirts: SizeChart = {
  title: "Skirts",
  columns: ["Waist (cm)", "Hip (cm)"],
  rows: [
    { size: "XS", values: ["60–63", "86–89"] },
    { size: "S", values: ["65–68", "91–94"] },
    { size: "M", values: ["70–73", "96–99"] },
    { size: "L", values: ["75–79", "101–105"] },
    { size: "XL", values: ["81–86", "107–112"] },
    { size: "XXL", values: ["88–93", "114–119"] },
  ],
};

function SizeChartCard({ chart }: { chart: SizeChart }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{chart.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Table's own wrapper scrolls horizontally on narrow screens so the
            page body never does. */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Size</TableHead>
              {chart.columns.map((column) => (
                <TableHead key={column}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {chart.rows.map((row) => (
              <TableRow key={row.size}>
                <TableCell className="font-medium">{row.size}</TableCell>
                {row.values.map((value, index) => (
                  <TableCell key={index}>{value}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function SizeGuideTables() {
  return (
    <Tabs defaultValue="men" className="max-w-3xl">
      <TabsList>
        <TabsTrigger value="men">Men</TabsTrigger>
        <TabsTrigger value="women">Women</TabsTrigger>
      </TabsList>
      <TabsContent value="men" className="space-y-6 mt-6">
        <SizeChartCard chart={menTops} />
        <SizeChartCard chart={menPants} />
      </TabsContent>
      <TabsContent value="women" className="space-y-6 mt-6">
        <SizeChartCard chart={womenTops} />
        <SizeChartCard chart={womenSkirts} />
      </TabsContent>
    </Tabs>
  );
}
