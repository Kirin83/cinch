import { API_ERROR_MESSAGE } from "@/types";

export default function TokenNotFound() {
  return (
    <div className="max-w-lg">
      <h1 className="font-mono text-2xl">404</h1>
      <p className="mt-3 text-sm">{API_ERROR_MESSAGE.NOT_INDEXED}</p>
    </div>
  );
}
