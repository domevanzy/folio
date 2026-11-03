import { answer } from "@/lib/rag/answer";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return answer(request, (await params).id, true);
}
