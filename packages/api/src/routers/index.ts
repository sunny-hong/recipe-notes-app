import { publicProcedure, router } from "../index";

import { recipeRouter } from "./recipe";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  recipe: recipeRouter,
});
export type AppRouter = typeof appRouter;
