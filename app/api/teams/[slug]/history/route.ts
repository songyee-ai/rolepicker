// GET /api/teams/[slug]/history?days=14
import { getHistory } from "@/back/api/history";

export const dynamic = "force-dynamic";
export const GET = getHistory;
