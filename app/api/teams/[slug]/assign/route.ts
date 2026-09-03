// POST /api/teams/[slug]/assign — 역할 뽑기 (멱등)
import { postAssign } from "@/back/api/assign";

export const POST = postAssign;
