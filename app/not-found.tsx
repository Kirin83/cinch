import { API_ERROR_MESSAGE } from "@/types";

export default function NotFound() {
  return (
    <div className="max-w-lg">
      <h1 className="font-display text-3xl tracking-tight">404</h1>
      <p className="mt-3 text-sm">{API_ERROR_MESSAGE.NOT_STOCK_TOKEN}</p>
    </div>
  );
}
