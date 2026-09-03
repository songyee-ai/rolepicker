// GET /api/teams/[slug] — 조 + 조원 + 오늘 배정
import { getTeam } from "@/back/api/teams";

export const dynamic = "force-dynamic";
export const GET = getTeam;
