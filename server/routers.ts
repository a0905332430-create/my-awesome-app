import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { TRPCError } from "@trpc/server";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { generateExampleSentence } from "./exampleGeneration";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  examples: router({
    generate: publicProcedure
      .input(
        z.object({
          word: z.string().trim().min(1).max(80),
          translation: z.string().trim().min(1).max(160),
          avoidSentence: z.string().trim().max(220).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        try {
          return await generateExampleSentence(input.word, input.translation, input.avoidSentence);
        } catch {
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: "例句暫時載入失敗，請稍後再試。",
          });
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
