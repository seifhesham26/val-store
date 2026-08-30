import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/currency";

interface ProductInfoProps {
  name: string;
  price: number;
  salePrice?: number;
  description: string;
}

export function ProductInfo({
  name,
  price,
  salePrice,
  description,
}: ProductInfoProps) {
  return (
    <>
      <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-4">
        {name}
      </h1>

      {/* Price */}
      <div className="flex items-center gap-3 mb-6">
        {salePrice ? (
          <>
            <span className="text-2xl font-bold text-red-400">
              {formatCurrency(salePrice)}
            </span>
            <span className="text-lg text-gray-500 line-through">
              {formatCurrency(price)}
            </span>
            <Badge variant="destructive" className="ml-2">
              {Math.round((1 - salePrice / price) * 100)}% OFF
            </Badge>
          </>
        ) : (
          <span className="text-2xl font-bold text-white">
            {formatCurrency(price)}
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-gray-400 mb-8 leading-relaxed">{description}</p>
    </>
  );
}
