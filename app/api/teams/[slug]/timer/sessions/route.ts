// GET 타이머 상태 · POST 세션 시작
import { getTimer, postSession } from "@/back/api/timer";

export const dynamic = "force-dynamic";
export const GET = getTimer;
export const POST = postSession;
